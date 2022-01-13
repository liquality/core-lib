import {
  IAccount,
  IConfig,
  MarketDataType,
  NetworkEnum,
  QuoteType,
  SwapPayloadType,
  SwapTransactionType
} from '../types'
import { BigNumber } from '@liquality/types'

type TransactionStatusType = {
  step: number
  label: string
  filterStatus: string
  notification?: (...args: unknown[]) => Record<string, string>
}

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

  /**
   * This hook is called when state updates are required
   * @param network
   * @param walletId
   * @param swap
   * @return updates An object representing updates to the current swap in the history
   */
  abstract performNextSwapAction(network: NetworkEnum, walletId: string, swap: any)

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
