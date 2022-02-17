import { HistoryItem, IAccount, IRuleEngine, SwapTransactionType } from '../types'
import { Engine, RuleProperties } from 'json-rules-engine'
import SovrynSwapProvider from '../swaps/sovryn-swap-provider'

class SovrynRuleEngine implements IRuleEngine {
  private _ruleEngine: Engine
  private _fromAccount: IAccount
  private _toAccount: IAccount
  private _swapProvider: SovrynSwapProvider
  private _swap: Partial<SwapTransactionType>
  private _currentStep: number
  private readonly _callback: (payload: Partial<SwapTransactionType>) => void
  private readonly _totalSteps = 4

  constructor(
    fromAccount: IAccount,
    toAccount: IAccount,
    swapProvider: SovrynSwapProvider,
    swap: Partial<SwapTransactionType>,
    callback: (historyItem: HistoryItem) => void
  ) {
    this._fromAccount = fromAccount
    this._toAccount = toAccount
    this._swapProvider = swapProvider
    this._swap = swap
    this._currentStep = 1
    this._callback = (payload: Partial<SwapTransactionType>) => {
      callback({
        id: payload.id,
        to: payload.to,
        from: payload.from,
        fromAddress: payload.fromAddress,
        toAddress: payload.toAddress,
        startTime: Date.parse(payload.createdAt),
        totalSteps: this._totalSteps,
        swapTransaction: payload,
        type: 'SWAP',
        currentStep: this._currentStep,
        status: payload.status,
        endTime: payload.endTime
      })
    }
    this._ruleEngine = new Engine(SovrynRuleEngine.getRules(toAccount, fromAccount, swapProvider))
  }

  getTotalSteps(): number {
    return 0
  }

  start(): Promise<void> {
    return Promise.resolve(undefined)
  }

  private static getRules(
    toAccount: IAccount,
    fromAccout: IAccount,
    swapProvider: SovrynSwapProvider
  ): RuleProperties[] {
    console.log(toAccount, fromAccout, swapProvider)
    return []
  }
}

export default SovrynRuleEngine
