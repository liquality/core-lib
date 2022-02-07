import { Engine, RuleProperties } from 'json-rules-engine'
import { HistoryItem, IAccount, IRuleEngine, SwapTransactionType } from '../types'
import LiqualitySwapProvider from '../swaps/liquality-swap-provider'
import { withInterval } from '../utils'

/**
 * A rule engine that makes sure an atomic swap is executed all the way to the end
 * We need to pass a fact with an EXPIRATION status to start the engine, and the engine
 * takes care of moving the transaction through all the steps
 */
class LiqualityRuleEngine implements IRuleEngine {
  private _ruleEngine: Engine
  private _fromAccount: IAccount
  private _toAccount: IAccount
  private _swapProvider: LiqualitySwapProvider
  private _swap: Partial<SwapTransactionType>
  private _currentStep: number
  private readonly _callback: (payload: Partial<SwapTransactionType>) => void
  private readonly _totalSteps = 4

  constructor(
    fromAccount: IAccount,
    toAccount: IAccount,
    swapProvider: LiqualitySwapProvider,
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
    this._ruleEngine = new Engine(this.getRules(toAccount, fromAccount, swapProvider))
  }

  public getTotalSteps(): number {
    return this._totalSteps
  }

  public async start(): Promise<void> {
    console.log('Starting liquality swap rules engine')
    const fact = {
      EXPIRATION: true
    }

    await this._ruleEngine.run(fact)
  }

  /**
   * Helper method to build a rule
   * @param status
   * @param priority
   * @param onSuccess
   * @param onFailure
   * @private
   */
  private static buildRule(
    status: string,
    priority: number,
    onSuccess: (event, almanac) => void,
    onFailure: (event, almanac) => void
  ): RuleProperties {
    return {
      conditions: {
        any: [
          {
            fact: status,
            operator: 'equal',
            value: true
          }
        ]
      },
      event: {
        type: status,
        params: {
          message: `${status} triggered`
        }
      },
      priority,
      onSuccess,
      onFailure
    }
  }

  /**
   * Helper method that returns all the rules used by the rules engine
   * @param toAccount
   * @param fromAccount
   * @param swapProvider
   */
  private getRules = (
    toAccount: IAccount,
    fromAccount: IAccount,
    swapProvider: LiqualitySwapProvider
  ): RuleProperties[] => {
    const expirationRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'EXPIRATION',
      11,
      async (event, almanac) => {
        const hasSwapExpired = await swapProvider.hasSwapExpired(fromAccount, this._swap)
        if (this._callback && hasSwapExpired)
          this._callback({
            status: 'EXPIRED'
          })
        almanac.addRuntimeFact('WAITING_FOR_REFUND', hasSwapExpired)
        almanac.addRuntimeFact('INITIATED', !hasSwapExpired)
      },
      () => {
        throw new Error('Rule trigger invalid')
      }
    )

    const waitingForRefundRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'WAITING_FOR_REFUND',
      10,
      async (event, almanac) => {
        await swapProvider.waitForRefund(fromAccount, this._swap)
        if (this._callback)
          this._callback({
            ...this._swap,
            status: 'GET_REFUND'
          })
        almanac.addRuntimeFact('GET_REFUND', true)
      },
      (event, almanac) => {
        almanac.addRuntimeFact('GET_REFUND', false)
      }
    )

    const getRefundRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'GET_REFUND',
      9,
      async (event, almanac) => {
        const { refundHash, status } = await swapProvider.refundSwap(fromAccount, this._swap)
        this._swap = {
          ...this._swap,
          refundHash,
          status
        }
        if (this._callback) this._callback(this._swap)
        almanac.addRuntimeFact('WAITING_FOR_REFUND_CONFIRMATIONS', true)
      },
      (event, almanac) => {
        almanac.addRuntimeFact('WAITING_FOR_REFUND_CONFIRMATIONS', false)
      }
    )

    const refundConfirmationRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'WAITING_FOR_REFUND_CONFIRMATIONS',
      8,
      async () => {
        const confirmation = await withInterval(async () =>
          swapProvider.waitForRefundConfirmations(fromAccount, this._swap)
        )
        this._swap = {
          ...this._swap,
          ...confirmation
        }
        if (this._callback) this._callback(this._swap)
      },
      () => {
        // Dispatch that the this._swap refund has failed
      }
    )

    const initiatedRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'INITIATED',
      7,
      async (event, almanac) => {
        await swapProvider.updateOrder(this._swap)
        if (this._callback)
          this._callback({
            ...this._swap,
            status: 'INITIATION_REPORTED'
          })
        almanac.addRuntimeFact('INITIATION_REPORTED', true)
      },
      function (event, almanac) {
        almanac.addRuntimeFact('INITIATION_REPORTED', false)
      }
    )

    const initiationReportedRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'INITIATION_REPORTED',
      6,
      async (event, almanac) => {
        if (!this._swap.toFundHash) {
          const confirmation = await withInterval(async () =>
            swapProvider.confirmInitiation(fromAccount, toAccount, this._swap)
          )
          if (confirmation) {
            this._swap = {
              ...this._swap,
              ...confirmation
            }
            if (this._callback) this._callback(this._swap)
            almanac.addRuntimeFact('INITIATION_CONFIRMED', true)
          } else {
            almanac.addRuntimeFact('INITIATION_CONFIRMED', false)
          }
        } else {
          if (this._callback) this._callback(this._swap)
          almanac.addRuntimeFact('INITIATION_CONFIRMED', true)
        }
      },
      function (event, almanac) {
        almanac.addRuntimeFact('INITIATION_CONFIRMED', false)
      }
    )

    const initiationConfirmedRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'INITIATION_CONFIRMED',
      5,
      async (event, almanac) => {
        if (!this._swap.fundTxHash) {
          const { fundTxHash, status } = await swapProvider.fundSwap(fromAccount, this._swap)
          this._swap = {
            ...this._swap,
            fundTxHash,
            status
          }
        }

        if (this._callback) this._callback(this._swap)
        almanac.addRuntimeFact('FUNDED', true)
      },
      function (event, almanac) {
        almanac.addRuntimeFact('FUNDED', false)
      }
    )

    //This rule only applies to ERC20
    const fundedRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'FUNDED',
      4,
      async (event, almanac) => {
        if (!this._swap.toFundHash) {
          const { toFundHash, status } = await withInterval(async () =>
            swapProvider.findCounterPartyInitiation(toAccount, this._swap)
          )
          this._swap = {
            ...this._swap,
            toFundHash,
            status
          }
        }

        if (this._callback) this._callback(this._swap)
        almanac.addRuntimeFact('CONFIRM_COUNTER_PARTY_INITIATION', true)
      },
      (event, almanac) => {
        almanac.addRuntimeFact('CONFIRM_COUNTER_PARTY_INITIATION', false)
      }
    )

    const counterPartyInitiationConfirmationRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'CONFIRM_COUNTER_PARTY_INITIATION',
      3,
      async (event, almanac) => {
        if (!this._swap.toFundHash) {
          const { toFundHash, status } = await withInterval(async () =>
            swapProvider.findCounterPartyInitiation(toAccount, this._swap)
          )
          this._swap = {
            ...this._swap,
            toFundHash,
            status
          }
        }

        this._currentStep++
        if (this._callback) this._callback(this._swap)
        almanac.addRuntimeFact('READY_TO_CLAIM', true)
      },
      (event, almanac) => {
        almanac.addRuntimeFact('READY_TO_CLAIM', false)
      }
    )

    const readyToClaimRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'READY_TO_CLAIM',
      2,
      async (event, almanac) => {
        if (!this._swap.toClaimHash) {
          const { toClaimHash, toClaimTx, status } = await swapProvider.claimSwap(toAccount, this._swap)
          this._swap = {
            ...this._swap,
            toClaimHash,
            toClaimTx,
            status
          }
        }

        this._currentStep++
        if (this._callback) this._callback(this._swap)
        almanac.addRuntimeFact('WAITING_FOR_CLAIM_CONFIRMATIONS', true)
      },
      (event, almanac) => {
        almanac.addRuntimeFact('WAITING_FOR_CLAIM_CONFIRMATIONS', false)
      }
    )

    const claimConfirmationRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'WAITING_FOR_CLAIM_CONFIRMATIONS',
      1,
      async (event, almanac) => {
        if (!this._swap.endTime) {
          const { endTime, status } = await withInterval(async () =>
            swapProvider.waitForClaimConfirmations(toAccount, this._swap)
          )
          this._swap = {
            ...this._swap,
            endTime,
            status
          }
        }

        this._currentStep++
        if (this._callback) this._callback(this._swap)
        almanac.addRuntimeFact('SUCCESS', true)
      },
      (event, almanac) => {
        almanac.addRuntimeFact('SUCCESS', false)
      }
    )

    return [
      expirationRule,
      waitingForRefundRule,
      getRefundRule,
      refundConfirmationRule,
      initiatedRule,
      initiationReportedRule,
      initiationConfirmedRule,
      fundedRule,
      counterPartyInitiationConfirmationRule,
      readyToClaimRule,
      claimConfirmationRule
    ]
  }
}

export default LiqualityRuleEngine
