import {
  AccountMapping,
  AccountType,
  Hardware,
  IAccount,
  IConfig,
  IEncryption,
  InitialStateType,
  IStorage,
  IWallet,
  Mnemonic,
  NetworkEnum,
  StateType
} from './types'
import { assets as cryptoassets, ChainId } from '@liquality/cryptoassets'
import { generateMnemonic, validateMnemonic } from 'bip39'
import { v4 as uuidv4 } from 'uuid'
import EthereumAccount from './accounts/ethereum-account'
import BitcoinAccount from './accounts/bitcoin-account'
import axios from 'axios'

export default class Wallet implements IWallet<StateType> {
  private SALT_BYTE_COUNT = 32
  private _storage: IStorage<StateType>
  private _encryption: IEncryption
  private _callback: (account: AccountType) => void
  private _config: IConfig
  private _accounts: AccountMapping
  private _mnemonic: Mnemonic
  private _password: string

  public constructor(storage: IStorage<StateType>, encryption: IEncryption, config: IConfig) {
    this._storage = storage
    this._encryption = encryption
    this._config = config
    this._accounts = {}
  }

  public init(password: string, mnemonic: Mnemonic): InitialStateType {
    this._mnemonic = mnemonic
    this._password = password
    const walletId = uuidv4()

    return {
      activeWalletId: walletId,
      activeNetwork: this._config.getDefaultNetwork(),
      name: 'Account-1',
      at: Date.now(),
      keySalt: this._encryption.generateSalt(this.SALT_BYTE_COUNT),
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
      }
    }
  }

  public async build(password: string, mnemonic: Mnemonic, imported: boolean): Promise<StateType> {
    const initialState = this.init(password, mnemonic)
    const { activeWalletId, name, keySalt, at, activeNetwork, accounts, fees } = initialState
    const walletState: StateType = {
      wallets: [
        {
          id: activeWalletId,
          at,
          name,
          assets: this._config.getDefaultEnabledAssets(activeNetwork),
          activeNetwork,
          mnemonic,
          imported
        }
      ],
      activeWalletId,
      activeNetwork,
      key: password,
      keySalt,
      accounts,
      fees,
      fiatRates: {},
      enabledAssets: {
        [NetworkEnum.Testnet]: {
          [activeWalletId]: this._config.getDefaultEnabledAssets(NetworkEnum.Testnet)
        },
        [NetworkEnum.Mainnet]: {
          [activeWalletId]: this._config.getDefaultEnabledAssets(NetworkEnum.Mainnet)
        }
      }
    }

    this.subscribe((account: AccountType) => {
      if (walletState.accounts) {
        walletState.accounts[activeWalletId!][activeNetwork!] = [account]
      }
      Object.assign(walletState.fiatRates, account.fiatRates)

      if (walletState.fees?.[activeNetwork]?.[activeWalletId] && account.feeDetails) {
        walletState.fees[activeNetwork][activeWalletId][account.chain] = account.feeDetails
      }
    })

    await this.addAccounts(activeNetwork)

    walletState.encryptedWallets = await this._encryption.encrypt(
      JSON.stringify(walletState.wallets),
      keySalt,
      password
    )

    return walletState
  }

  public async store(walletState: StateType): Promise<boolean> {
    await this._storage.write(walletState)
    return true
  }

  public async restore(password?: string): Promise<StateType> {
    const walletState = await this._storage.read()
    const { encryptedWallets, keySalt, activeWalletId, activeNetwork } = walletState

    if (!encryptedWallets || !keySalt) {
      throw new Error('Please import/create your wallet')
    }

    if (password) {
      const decryptedWallets = await this._encryption.decrypt(encryptedWallets!, keySalt!, password)
      if (!decryptedWallets) {
        throw new Error('Password Invalid')
      }

      const wallets = JSON.parse(decryptedWallets)

      if (!wallets || wallets.length === 0) {
        throw new Error('Password Invalid')
      }

      //recreate the wallet
      this._password = password
      this._mnemonic = wallets[0].mnemonic //TODO refactor once we start supporting multi-wallet
      for (const acct of walletState.accounts[activeWalletId][activeNetwork]) {
        await this.addAccount(acct.chain, activeNetwork)
      }

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
    const account: IAccount = this.accountFactory(this._config, this._mnemonic, 0, chain, network, [])
    this._accounts[accountKey] = account
    if (this._callback) this._callback(await account.build())
    return account
  }

  public async addAccounts(network: NetworkEnum, hardware?: Hardware): Promise<AccountMapping> {
    if (hardware) return
    for (const chain of this._config.getDefaultEnabledChains(network)) {
      await this.addAccount(chain, network)
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

  public async refresh() {
    for (const account of Object.values(this._accounts)) {
      const result = await account.refresh()
      if (this._callback) this._callback(result)
    }
  }

  public async fetchPricesForAssets(
    baseCurrencies: Array<string>,
    toCurrency: string
  ): Promise<StateType['fiatRates']> {
    const coindIds = baseCurrencies
      .filter((currency) => cryptoassets[currency]?.coinGeckoId)
      .map((currency) => cryptoassets[currency].coinGeckoId)
    const requestUrl = `${this._config.getPriceFetcherUrl()}/simple/price?ids=${coindIds.join(
      ','
    )}&vs_currencies=${toCurrency}`
    const { data } = await axios.get(requestUrl)

    const prices = Object.keys(data).reduce((acc: any, coinGeckoId) => {
      const asset = Object.entries(cryptoassets).find((entry) => {
        return entry[1].coinGeckoId === coinGeckoId
      })
      if (asset) {
        acc[asset[0]] = {
          [toCurrency.toUpperCase()]: data[coinGeckoId][toCurrency.toLowerCase()]
        }
      }

      return acc
    }, {})

    for (const baseCurrency of baseCurrencies) {
      if (!prices[baseCurrency] && cryptoassets[baseCurrency].matchingAsset) {
        prices[baseCurrency] = prices[cryptoassets[baseCurrency].matchingAsset]
      }
    }

    return Object.keys(prices).reduce((acc: any, assetName) => {
      acc[assetName] = prices[assetName][toCurrency.toUpperCase()]
      return acc
    }, {})
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

  private accountFactory(
    config: IConfig,
    mnemonic: Mnemonic,
    index: number,
    chain: ChainId,
    network: NetworkEnum,
    assets: string[]
  ) {
    switch (chain) {
      case ChainId.Ethereum:
        return new EthereumAccount(config, mnemonic, 0, chain, network, assets)
      case ChainId.Bitcoin:
        return new BitcoinAccount(config, mnemonic, 0, chain, network, assets)
    }
  }
}
