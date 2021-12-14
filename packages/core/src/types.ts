// Wallet: It manages private keys, performs signing operations, storing local state, and acts as a middleware between the Mobile/Extension app and the Chain Abstraction Layer (CAL).
// Account: It represents a blockchain
// Asset: It represents an asset that belongs to a blockchain
// Transaction: It represents transactions like send, receive, and swap that are specific to an asset.

// Encryption
// Storage
// Runnable
// Notifications
// Plugins

import { ChainId } from '@liquality/cryptoassets'
import { Address, BigNumber, FeeDetails, SendOptions, Transaction } from '@liquality/types'
import { BitcoinNetwork } from '@liquality/bitcoin-networks'
import { EthereumNetwork } from '@liquality/ethereum-networks'

export type Mnemonic = string

export enum NetworkEnum {
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}

export enum Network {
  MAINNET,
  TESTNET
}

export enum Token {
  NATIVE,
  ERC20,
  ERC721
}

export enum Hardware {
  LEDGER
}

export type AccountMapping = Record<string, IAccount>

export interface IStorage<T> {
  write: (data: T) => Promise<boolean | Error>
  read: () => Promise<T>
}

export interface IEncryption {
  generateSalt: (byteCount: number) => string
  encrypt: (value: string, keySalt: string, password: string) => Promise<string>
  decrypt: (encrypted: string, keySalt: string, password: string) => Promise<string>
}

/**
 * Converts data between the raw format that is used within the client app and the more friendly format that is used to interact with the UI and CAL
 */
export interface IDataMapper<RawState, DigestedState> {
  marshall(input: RawState): DigestedState
}

export interface IConfig {
  getEthereumTestnet(): string
  getEthereumMainnet(): string
  getBitcoinMainnet(): string
  getBitcoinTestnet(): string
  getBatchEsploraAPIUrl(network: NetworkEnum): string
  getChainNetwork(chain: ChainId, network: NetworkEnum): BitcoinNetwork & EthereumNetwork
  getDefaultEnabledChains(network: NetworkEnum): ChainId[]
  getDefaultEnabledAssets(network: NetworkEnum): string[]
  getPriceFetcherUrl(): string
  getDefaultNetwork(): NetworkEnum
  getChainColor(chain: ChainId): string
  getBitcoinFeeUrl(): string
  getTestnetContractAddress(assetSymbol: string): string
  getSovereignRPCAPIUrl(network: NetworkEnum): string
}

export interface IWalletConstructor<T> {
  new (
    storage: IStorage<T>,
    encryption: IEncryption,
    dataMapper: IDataMapper<T, IAccount[]>,
    config: IConfig
  ): IWallet<T>
}

/**
 * This is the main entry to the core-lib world, all the interactions should go through it
 */
export interface IWallet<T> {
  /**
   * Generates some values necessary to build the wallet state on the client
   */
  init(password: string, mnemonic: string): InitialStateType

  /**
   * One stop shop that shows how to build a functioning wallet
   * @param password
   * @param mnemonic
   * @param imported
   */
  build(password: string, mnemonic: Mnemonic, imported: boolean): Promise<StateType>

  /**
   * Encrypts and stores wallet state in local storage
   * @param walletState
   */
  store(walletState: T): Promise<boolean>

  /**
   * Retrieves and decrypts wallet state from local storage
   * Also built the Wallet object to reflect the restored retrieved state
   * @param password if provided the encrypted data will decrypted
   */
  restore(password?: string): Promise<StateType>

  /**
   * Creates and hydrates a new account
   * @param chain
   * @param network
   * @param hardware
   */
  addAccount(chain: ChainId, network: NetworkEnum, hardware?: Hardware): Promise<IAccount>

  /**
   * Add all accounts enabled in the config under a specific network
   * @param network
   * @param hardware
   */
  addAccounts(network: NetworkEnum, hardware?: Hardware): Promise<AccountMapping>

  /**
   * Returns an already fetched account by chain and network
   * @param chain
   * @param network
   */
  getAccount(chain: ChainId, network: NetworkEnum): IAccount

  /**
   * Returns all the accounts that have been fetched so far.
   */
  getAccounts(): AccountMapping

  /**
   * Subscribes a callback that will be called whenever the accounts have been fetched/updated
   * @param callback
   */
  subscribe(callback: (account: AccountType) => void)

  /**
   * Refresh balances, fees and fiat rates for the different accounts/assets
   */
  refresh()

  /**
   * Fetches the fiat prices/rates for the provided list of assets
   * @param baseCurrencies
   * @param toCurrency
   */
  fetchPricesForAssets(baseCurrencies: Array<string>, toCurrency: string): Promise<StateType['fiatRates']>

  /**
   * Checks if the current wallet is newly installed
   */
  isNewInstallation(): Promise<boolean>
}

export interface IAccountConstructor {
  new (mnemonic: Mnemonic, index: number, chain: ChainId, network: NetworkEnum, hardware?: Hardware): IAccount
}

export interface IAccount {
  /**
   * Builds an account that has all the necessary information
   *
   */
  build(): Promise<AccountType>

  /**
   * Computes the derivation path
   */
  calculateDerivationPath(): string

  /**
   * Fetches all the assets belonging to the associated account.
   * It only exposes the assets that are enabled in the Config object
   */
  getAssets(): Promise<IAsset[]>

  /**
   * Fetches an address that has not seen any transactions
   */
  getUnusedAddress(): Promise<Address>

  /**
   * Fetches the addresses that has seen some transactions and return the first one
   */
  getUsedAddress(): Promise<Address>

  /**
   * Computes the public key of the current account
   */
  getPublicKey(): Promise<string>

  /**
   * Computes the private key of the current account
   */
  getPrivateKey(): Promise<string>

  /**
   * Fetches the balance associated with the current account address
   */
  getBalance(): Promise<BigNumber>

  /**
   * Fetches fees for all assets associated with the current account
   */
  getFeeDetails(): Promise<FeeDetails>

  /**
   * Fetches fiat rates for the assets associated with the current account
   */
  fetchPricesForAssets(toCurrency: string): Promise<StateType['fiatRates']>
  refresh(): Promise<AccountType>
}

export interface IAsset {
  /**
   * Return the asset name.
   */
  getSymbol(): string

  /**
   * Returns the address associated with the current asset
   */
  getAddress(): string

  /**
   * Fetches the asset balance
   */
  getBalance(): Promise<BigNumber>

  /**
   * Performs a transaction
   * @param options the payload information necessary to perform the transaction
   * @returns return a transaction object
   */
  transmit(options: SendOptions): Promise<Transaction>

  /**
   * Fetches past transactions
   */
  getPastTransactions(): Promise<Transaction[]>
}

//-----------------------------------DATA TYPES----------------------------
export type GasSpeedType = 'slow' | 'average' | 'fast'
export type InitialStateType = {
  activeWalletId: string
  activeNetwork: NetworkEnum
  name: string
  at: number
  keySalt: string
  accounts: StateType['accounts']
  fees: StateType['fees']
}

export interface AccountType {
  name: string
  chain: ChainId
  type: string
  index: number
  addresses: Array<string>
  assets: Array<string>
  balances?: Record<string, number>
  fiatRates?: Record<string, number>
  feeDetails?: FeeDetails
  color: string
  createdAt: number
  updatedAt?: number
}

export type ChainNetworkType = Record<
  ChainId,
  Record<NetworkEnum.Mainnet & NetworkEnum.Testnet, BitcoinNetwork & EthereumNetwork>
>

// helper to get the type of an array element
export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

export interface FlatState {
  assetCount: number
  totalBalance: BigNumber
  totalBalanceInFiat: BigNumber
}

export interface StateType {
  // <do not keep these in localStorage>
  key?: string
  wallets?: {
    id: string
    at: number
    name: string
    assets?: Array<string>
    activeNetwork?: NetworkEnum
    mnemonic?: string
    imported?: boolean
  }[]
  unlockedAt?: number
  // </do not keep these in localStorage>

  version?: number
  brokerReady?: boolean
  encryptedWallets?: string
  enabledAssets?: Record<
    NetworkEnum,
    {
      [walletId: string]: string[]
    }
  >
  customTokens?: unknown
  accounts?: Record<string, Partial<Record<NetworkEnum, AccountType[]>>>
  fiatRates?: Record<string, number>
  fees?: Partial<
    Record<
      NetworkEnum,
      {
        [walletId: string]: {
          [asset: string]: FeeDetails
        }
      }
    >
  >
  history?: unknown
  marketData?: unknown
  activeNetwork?: NetworkEnum
  activeWalletId?: string
  activeAsset?: unknown
  keyUpdatedAt?: number
  keySalt?: string
  termsAcceptedAt?: number
  setupAt?: number
  injectEthereum?: boolean
  injectEthereumChain?: string
  usbBridgeWindowsId?: number
  externalConnections?: unknown
  analytics?: {
    userId: string
    acceptedDate: number
    askedDate: number
    askedTimes: number
    notAskAgain: boolean
  }
  errorMessage?: string
}
