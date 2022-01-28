import {
  IAccount,
  IConfig,
  MarketDataType,
  QuoteType,
  SwapPayloadType,
  SwapTransactionType,
  TransactionStatusType
} from '../types'
import { BigNumber } from '@liquality/types'

abstract class SwapProvider {
  protected _config: IConfig
  protected _statuses: Record<string, TransactionStatusType>
  protected _fromTxType: string
  protected _toTxType: string
  protected _timelineDiagramSteps: string[]
  protected _totalSteps: number

  /**
   * Get the supported pairs of this provider for this network
   * @param network
   */
  abstract getSupportedPairs(): Promise<MarketDataType[]>

  /**
   * Get a quote for the specified parameters
   * @param marketData
   * @param from
   * @param to
   * @param amount
   */
  abstract getQuote(marketData: MarketDataType[], from: string, to: string, amount: BigNumber): Promise<QuoteType>

  /**
   * Create a new swap for the given quote
   * @param fromAccount
   * @param toAccount
   * @param fromAsset
   * @param quote
   */
  abstract performSwap(
    fromAccount: IAccount,
    toAccount: IAccount,
    quote: Partial<SwapPayloadType>
  ): Promise<Partial<SwapTransactionType>>

  /**
   * Start the rules engine that executes the swaps
   * @param fromAccount
   * @param toAccount
   * @param swapTransaction
   */
  abstract runRulesEngine(fromAccount: IAccount, toAccount: IAccount, swapTransaction: Partial<SwapTransactionType>)

  /**
   * Estimate the fees for the given parameters
   * @param fromAccount
   * @param fromAsset
   * @param txType
   * @param quote
   * @param feePrices
   * @param max
   */
  abstract estimateFees(
    fromAccount: IAccount,
    fromAsset: string,
    txType: string,
    quote: QuoteType,
    feePrices: number[],
    max?: number
  ): Promise<Record<number, BigNumber>>

  public get statuses() {
    return this._statuses
  }

  public get fromTxType() {
    return this._fromTxType
  }

  public get toTxType() {
    return this._toTxType
  }

  public get timelineDiagramSteps() {
    return this._timelineDiagramSteps
  }

  public get totalSteps() {
    return this._totalSteps
  }
}

export default SwapProvider
