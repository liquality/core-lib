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
import { Client } from '@liquality/client'
import { BitcoinNetwork } from '@liquality/bitcoin-networks'
import { EthereumNetwork } from '@liquality/ethereum-networks'
import SwapProvider from './swaps/swap-provider'

export type SwapProviderIdType = 'liquality' | 'uniswapV2' | 'sovryn' | 'liqualityBoost'

export type SwapProviderType = {
  name: string
  icon: string
  type: SwapProvidersEnum
  agent?: string
  node?: string
  network?: string
  routerAddress?: string
  routerAddressRBTC?: string
  rpcURL?: string
  supportedBridgeAssets?: string[]
}

export type Mnemonic = string

export enum SwapProvidersEnum {
  LIQUALITY = 'LIQUALITY',
  LIQUALITYBOOST = 'LIQUALITYBOOST',
  SOVRYN = 'SOVRYN',
  THORCHAIN = 'THORCHAIN'
}

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
  getSwapProvider(network: NetworkEnum, providerId: string): SwapProviderType
  getSwapProviders(network: NetworkEnum): Partial<Record<SwapProvidersEnum, SwapProviderType>>
  getAgentUrl(network: NetworkEnum, providerId: SwapProvidersEnum): string
  getInfuraAPIKey(): string
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
  init(password: string, mnemonic: Mnemonic, imported: boolean): Promise<StateType>

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
   * Returns the active/enabled swap providers
   */
  getSwapProviders(): Partial<Record<SwapProvidersEnum, SwapProvider>>

  /**
   * Subscribes a callback that will be called whenever the accounts have been fetched/updated
   * @param event The event that triggers the provided callback
   * @param callback
   */
  subscribe(callback: (account: AccountType) => void)

  /**
   * Subscribes a callback that will be called whenever the corresponding trigger has been fired off
   * @param trigger
   * @param callback
   */
  on(trigger: TriggerType, callback: (...args: unknown[]) => void)

  /**
   * Refresh balances, fees and fiat rates for the different accounts/assets
   */
  refresh()

  /**
   * Return a swap provider if it exists, otherwise, create a new one and return it
   * @param swapProviderType
   */
  getSwapProvider(swapProviderType: SwapProvidersEnum): SwapProvider

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

  /**
   * Refreshes the account info
   */
  refresh(): Promise<AccountType>

  getClient(): Client

  /**
   * Speeds up an already submitted transaction
   * @param transaction
   * @param newFee
   */
  speedUpTransaction(transaction: string | Transaction, newFee: number): Promise<Transaction>
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
   * Returns the client used by the current asset
   */
  getClient(): Client

  /**
   * Performs a transaction
   * @param options the payload information necessary to perform the transaction
   * @returns return a transaction object
   */
  transmit(options: SendOptions): Promise<HistoryItem>

  /**
   * Starts a rule engine that will keep track of the transactions until it is confirmed
   * @param transaction
   */
  runRulesEngine(transaction: Transaction): void

  /**
   * Fetches past transactions
   */
  getPastTransactions(): Promise<Transaction[]>
}

export interface ISwapProvider {
  getSupportedPairs(): Promise<MarketDataType[]>
  getQuote(marketData: MarketDataType[], from: string, to: string, amount: BigNumber): QuoteType
  performSwap(
    fromAccount: IAccount,
    toAccount: IAccount,
    fromAsset: string,
    quote: Partial<SwapPayloadType>
  ): Promise<Partial<SwapTransactionType>>
  estimateFees(
    asset: string,
    txType: string,
    quote: QuoteType,
    feePrices: number[],
    max: number
  ): Promise<Record<number, BigNumber>>
}

export interface IRuleEngine {
  getTotalSteps(): number
  start(): Promise<void>
}

//-----------------------------------DATA TYPES----------------------------
export type LockedQuoteType = {
  id: string
  orderId: string
  from: string
  to: string
  fromAmount: number
  toAmount: number
  rate: number
  spread: number
  minConf: number
  expiresAt: number
  hasAgentUnconfirmedTx: boolean
  hasUserUnconfirmedTx: boolean
  hasUnconfirmedTx: boolean
  status: string //'QUOTE' | 'INITIATED'
  userAgent: string //userAgent version
  swapExpiration: number
  nodeSwapExpiration: number
  fromRateUsd: number
  toRateUsd: number
  fromAmountUsd: number
  toAmountUsd: number
  fromCounterPartyAddress: string
  toCounterPartyAddress: string
  createdAt: string
  updatedAt: string
  totalAgentFeeUsd: number
  totalUserFeeUsd: number
  totalFeeUsd: number
}

export type RequestDataType = {
  from: string
  to: string
  fromAmount: number
  toAmount: number
}

export interface MergedQuoteType extends LockedQuoteType {
  fromAddress: string
  toAddress: string
  fee: number
  claimFee: number
}

export type TriggerType =
  | 'onInit'
  | 'onAccountUpdate'
  | 'onMarketDataUpdate'
  | 'onFiatRatesUpdate'
  | 'onTransactionUpdate'
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

export type MarketDataType = {
  provider: string
  from: string
  to: string
  rate: number
  min: number
  max: number
}

export type QuoteType = {
  from: string
  to: string
  fromAddress?: string
  toAddress?: string
  fromAmount?: BigNumber
  toAmount?: BigNumber
  expireAt?: number
  swapExpiration?: number
  fee?: number
  fromCounterPartyAddress?: string
  toCounterPartyAddress?: string
  path?: string
  provider?: SwapProvidersEnum
}

export type SwapPayloadType = {
  from: string
  to: string
  fromAmount: BigNumber
  toAmount: BigNumber
  type: string
  network: NetworkEnum
  startTime: number
  walletId: string
  fee: number
  claimFee: number
}

export interface SwapTransactionType extends MergedQuoteType {
  id: string
  from: string
  to: string
  fromAmount: number
  toAmount: number
  expireAt: number
  fee: number
  status: string
  secret: string
  secretHash: string
  slippage: number
  fromFundHash: string
  fromFundTx: Transaction
  toFundHash?: string
  toFundTx?: Transaction
  toClaimHash?: string
  toClaimTx?: Transaction
  fundTxHash?: string //specific to ERC20
  refundHash?: string
  endTime?: number
}

export type TransactionStatusType = {
  step: number
  label: string
  filterStatus: string
  notification?: (...args: unknown[]) => Record<string, string>
}

// helper to get the type of an array element
export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

export interface FlatState {
  assetCount: number
  totalBalance: BigNumber
  totalBalanceInFiat: BigNumber
}

export type HistoryItem = {
  id: string
  network?: NetworkEnum //TODO we might need this when the user changes the network before the transaction completes
  walletId?: string
  from: string
  to: string
  fromAddress: string
  toAddress: string
  startTime: number
  endTime?: number
  type: 'SWAP' | 'SEND' | 'RECEIVE'
  sendTransaction?: Transaction
  swapTransaction?: Partial<SwapTransactionType>
  totalSteps: number
  currentStep: number
  status: string
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
  history?: HistoryItem[]
  marketData?: MarketDataType[]
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
