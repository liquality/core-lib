import {
  AccountMapping,
  AccountType,
  Hardware,
  IAccount,
  IConfig,
  IEncryption,
  IStorage,
  IWallet,
  Mnemonic,
  NetworkEnum,
  StateType,
  SwapProvidersEnum,
  TriggerType
} from './types'
import { ChainId } from '@liquality/cryptoassets'
import { generateMnemonic, validateMnemonic } from 'bip39'
import { v4 as uuidv4 } from 'uuid'
import EthereumAccount from './accounts/ethereum-account'
import BitcoinAccount from './accounts/bitcoin-account'
import RSKAccount from './accounts/rsk-account'
import LiqualitySwapProvider from './swaps/liquality-swap-provider'
import SwapProvider from './swaps/swap-provider'
import SovrynSwapProvider from './swaps/sovryn-swap-provider'

export default class Wallet implements IWallet<StateType> {
  private SALT_BYTE_COUNT = 32
  private _storage: IStorage<StateType>
  private _encryption: IEncryption
  private _callback: (account: AccountType) => void
  private readonly _callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>>
  private readonly _config: IConfig
  private readonly _accounts: AccountMapping
  private _mnemonic: Mnemonic
  private _password: string
  private _activeNetwork: NetworkEnum
  private _activeWalletId: string
  private readonly _swapProviders: Partial<Record<SwapProvidersEnum, SwapProvider>>

  public constructor(storage: IStorage<StateType>, encryption: IEncryption, config: IConfig) {
    this._storage = storage
    this._encryption = encryption
    this._config = config
    this._accounts = {}
    this._swapProviders = {}
    this._callbacks = {}
    this._activeNetwork = config.getDefaultNetwork()

    for (const providerKey of Object.keys(this._config.getSwapProviders(this._activeNetwork))) {
      this._swapProviders[providerKey] = this.getSwapProvider(providerKey as SwapProvidersEnum)
    }
  }

  public async init(password: string, mnemonic: Mnemonic, imported: boolean): Promise<StateType> {
    const walletId = uuidv4()
    const keySalt = this._encryption.generateSalt(this.SALT_BYTE_COUNT)
    this._mnemonic = mnemonic
    this._password = password
    this._activeNetwork = this._config.getDefaultNetwork()

    const walletState: StateType = {
      wallets: [
        {
          id: walletId,
          name: 'Account-1',
          at: Date.now(),
          assets: this._config.getDefaultEnabledAssets(this._activeNetwork),
          activeNetwork: this._activeNetwork,
          mnemonic,
          imported
        }
      ],
      activeWalletId: (this._activeWalletId = walletId),
      activeNetwork: this._activeNetwork,
      key: password,
      keySalt,
      accounts: {
        [walletId]: {
          [NetworkEnum.Testnet]: [],
          [NetworkEnum.Mainnet]: []
        }
      },
      fees: {
        [NetworkEnum.Testnet]: {
          [walletId]: {}
        },
        [NetworkEnum.Mainnet]: {
          [walletId]: {}
        }
      },
      fiatRates: {},
      enabledAssets: {
        [NetworkEnum.Testnet]: {
          [walletId]: this._config.getDefaultEnabledAssets(NetworkEnum.Testnet)
        },
        [NetworkEnum.Mainnet]: {
          [walletId]: this._config.getDefaultEnabledAssets(NetworkEnum.Mainnet)
        }
      },
      history: []
    }

    walletState.encryptedWallets = await this._encryption.encrypt(
      JSON.stringify(walletState.wallets),
      keySalt,
      password
    )

    return walletState
  }

  public async build(password: string, mnemonic: Mnemonic, imported: boolean): Promise<StateType> {
    const walletState = await this.init(password, mnemonic, imported)
    const { activeWalletId, activeNetwork } = walletState

    this.subscribe((account: AccountType) => {
      if (walletState.accounts) {
        walletState.accounts[activeWalletId!][activeNetwork!].push(account)
      }
      Object.assign(walletState.fiatRates, account.fiatRates)

      if (walletState.fees?.[activeNetwork]?.[activeWalletId] && account.feeDetails) {
        walletState.fees[activeNetwork][activeWalletId][account.chain] = account.feeDetails
      }
    })

    await this.addAccounts(activeNetwork)

    return walletState
  }

  public async store(walletState: StateType): Promise<boolean> {
    await this._storage.write(walletState)
    return true
  }

  public async restore(password?: string): Promise<StateType> {
    const walletState = await this._storage.read()
    const { encryptedWallets, keySalt } = walletState

    if (!encryptedWallets || !keySalt) {
      throw new Error('Please import/create your wallet')
    }

    if (password) {
      const decryptedWallets = await this._encryption.decrypt(encryptedWallets, keySalt, password)
      if (!decryptedWallets) {
        throw new Error('Password Invalid-> ' + decryptedWallets + ' - ' + keySalt + ' - ' + password)
      }

      const wallets = JSON.parse(decryptedWallets)

      if (!wallets || wallets.length === 0) {
        throw new Error('Password Invalid - Wallets')
      }

      //recreate the wallet
      this._password = password
      this._mnemonic = wallets[0].mnemonic //TODO refactor once we start supporting multi-wallet

      return {
        ...walletState,
        key: password,
        unlockedAt: Date.now(),
        wallets
      }
    }

    return walletState
  }

  public async addAccount(chain: ChainId, network: NetworkEnum, hardware?: Hardware): Promise<IAccount> {
    if (hardware) return
    const accountKey = `${chain}-${network}`
    if (this._accounts[accountKey]) return this._accounts[accountKey]
    const account: IAccount = Wallet.accountFactory(
      this._config,
      this._mnemonic,
      0,
      chain,
      network,
      [],
      this._callbacks
    )
    const walletAccount = await account.build()
    this._accounts[accountKey] = account
    if (this._callback) this._callback(walletAccount)
    return account
  }

  public async addAccounts(network: NetworkEnum, hardware?: Hardware): Promise<AccountMapping> {
    if (hardware) return
    for (const chain of this._config.getDefaultEnabledChains(network)) {
      await this.addAccount(chain, network).catch((error) => {
        console.log(`addAccounts:${chain} ${error}`)
      })
    }

    return this._accounts
  }

  public getAccount(chain: ChainId, network: NetworkEnum): IAccount {
    return this._accounts[`${chain}-${network}`]
  }

  public getAccounts(): AccountMapping {
    return this._accounts
  }

  public subscribe(callback: (account: AccountType) => void) {
    this._callback = callback
  }

  public on(trigger: TriggerType, callback: (...args: unknown[]) => void) {
    this._callbacks[trigger] = callback
  }

  public async refresh() {
    for (const account of Object.values(this._accounts)) {
      const result = await account.refresh()
      if (this._callback) this._callback(result)
    }
  }

  public getSwapProvider(swapProviderType: SwapProvidersEnum): SwapProvider {
    if (this._swapProviders[swapProviderType]) return this._swapProviders[swapProviderType]

    if (swapProviderType === SwapProvidersEnum.LIQUALITY) {
      this._swapProviders[swapProviderType] = new LiqualitySwapProvider(
        this._config,
        this._activeNetwork,
        this._activeWalletId,
        this._callbacks
      )
    } else if (swapProviderType === SwapProvidersEnum.SOVRYN) {
      this._swapProviders[swapProviderType] = new SovrynSwapProvider(
        this._config,
        this._activeNetwork,
        this._activeWalletId,
        this._callbacks
      )
    }

    return this._swapProviders[swapProviderType]
  }

  public getSwapProviders(): Partial<Record<SwapProvidersEnum, SwapProvider>> {
    return this._swapProviders
  }

  public async isNewInstallation(): Promise<boolean> {
    return !(await this._storage.read())
  }

  public static generateSeedWords() {
    return generateMnemonic().split(' ')
  }

  public static validateSeedPhrase(seedPhrase: string) {
    return validateMnemonic(seedPhrase)
  }

  private static accountFactory(
    config: IConfig,
    mnemonic: Mnemonic,
    index: number,
    chain: ChainId,
    network: NetworkEnum,
    assets: string[],
    callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>>
  ) {
    switch (chain) {
      case ChainId.Ethereum:
        return new EthereumAccount(config, mnemonic, index, chain, network, assets, callbacks)
      case ChainId.Bitcoin:
        return new BitcoinAccount(config, mnemonic, index, chain, network, assets, callbacks)
      case ChainId.Rootstock:
        return new RSKAccount(config, mnemonic, index, chain, network, assets, callbacks)
    }
  }
}
