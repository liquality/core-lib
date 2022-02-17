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
    this._ruleEngine = new Engine()
  }

  public getTotalSteps(): number {
    return this._totalSteps
  }

  public async start(): Promise<void> {
    console.log('Starting liquality swap rules engine:', this._swap)

    const canRefund = await this._swapProvider.waitForRefund(this._fromAccount, this._swap)
    console.log('canRefund: ', canRefund)
    if (canRefund) {
      for (const rule of this.getRefundRules(this._toAccount, this._fromAccount, this._swapProvider)) {
        this._ruleEngine.addRule(rule)
      }
      this._ruleEngine.addFact('WAITING_FOR_REFUND', true)
    } else {
      for (const rule of this.getSwapRules(this._toAccount, this._fromAccount, this._swapProvider)) {
        this._ruleEngine.addRule(rule)
      }
      this._ruleEngine.addFact('INITIATED', true)
    }

    const response = await this._ruleEngine.run().catch((error) => {
      console.log('Failed to run engine: ', error)
    })
    console.log('response: ', response)
  }

  /**
   * Helper method to build a rule
   * @param factId
   * @param priority
   * @param onSuccess
   * @param onFailure
   * @private
   */
  private static buildRule(
    factId: string,
    priority: number,
    onSuccess: (event, almanac) => void,
    onFailure: (event, almanac) => void
  ): RuleProperties {
    return {
      conditions: {
        any: [
          {
            fact: factId,
            operator: 'equal',
            value: true
          }
        ]
      },
      event: {
        type: factId,
        params: {
          message: `${factId} triggered`
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
  private getRefundRules = (
    toAccount: IAccount,
    fromAccount: IAccount,
    swapProvider: LiqualitySwapProvider
  ): RuleProperties[] => {
    const waitingForRefundRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'WAITING_FOR_REFUND',
      10,
      async (event, almanac) => {
        console.log('WAITING_FOR_REFUND')
        const updates = await swapProvider.waitForRefund(fromAccount, this._swap)

        console.log('updates:', updates)
        if (updates) {
          console.log('updates1:', updates)
          this._swap = {
            ...this._swap,
            status: updates.status,
            statusMessage: 'Waiting for a refund'
          }
          if (this._callback) this._callback(this._swap)
          almanac.addRuntimeFact('GET_REFUND', true)
        } else {
          console.log('updates2:', updates)
          almanac.addRuntimeFact('INITIATION', true)
        }
      },
      (event, almanac) => {
        console.log('updates3:')
        almanac.addRuntimeFact('GET_REFUND', false)
      }
    )

    const getRefundRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'GET_REFUND',
      9,
      async (event, almanac) => {
        console.log('GET_REFUND')
        if (!this._swap.refundHash) {
          const { refundHash, status } = await swapProvider.refundSwap(fromAccount, this._swap)
          this._swap = {
            ...this._swap,
            refundHash,
            status,
            statusMessage: 'Getting a refund'
          }
          if (this._callback) this._callback(this._swap)
        }

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
        console.log('WAITING_FOR_REFUND_CONFIRMATIONS')
        const confirmation = await withInterval(async () =>
          swapProvider.waitForRefundConfirmations(fromAccount, this._swap)
        )
        this._swap = {
          ...this._swap,
          ...confirmation
        }
        if (this._callback) this._callback(this._swap)
        // Stop evaluating rules
        this._ruleEngine.stop()
      },
      () => {
        // Dispatch that the this._swap refund has failed
      }
    )

    return [waitingForRefundRule, getRefundRule, refundConfirmationRule]
  }

  private getSwapRules = (
    toAccount: IAccount,
    fromAccount: IAccount,
    swapProvider: LiqualitySwapProvider
  ): RuleProperties[] => {
    const initiatedRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'INITIATED',
      7,
      async (event, almanac) => {
        console.log('INITIATED')
        await swapProvider.updateOrder(this._swap).catch((error) => console.log(error))
        this._swap = {
          ...this._swap,
          status: 'INITIATION_REPORTED',
          statusMessage: 'Starting swap'
        }
        if (this._callback) this._callback(this._swap)
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
        console.log('INITIATION_REPORTED')
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
        console.log('INITIATION_CONFIRMED')
        if (!this._swap.fundTxHash) {
          const { fundTxHash, status } = await swapProvider.fundSwap(fromAccount, this._swap)
          this._swap = {
            ...this._swap,
            fundTxHash,
            status,
            statusMessage: `Locked ${this._swap.from}`
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
        console.log('FUNDED')
        if (!this._swap.toFundHash) {
          const { toFundHash, status } = await withInterval(async () =>
            swapProvider.findCounterPartyInitiation(fromAccount, toAccount, this._swap)
          )
          this._swap = {
            ...this._swap,
            toFundHash,
            status,
            statusMessage: `Locking ${this._swap.to}`
          }

          console.log('FUNDED: ', this._swap)

          if (this._callback) this._callback(this._swap)
          almanac.addRuntimeFact(status, true)
        } else {
          almanac.addRuntimeFact('CONFIRM_COUNTER_PARTY_INITIATION', true)
        }
      },
      (event, almanac) => {
        console.log('failed to process step: ')
        almanac.addRuntimeFact('CONFIRM_COUNTER_PARTY_INITIATION', false)
      }
    )

    const counterPartyInitiationConfirmationRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'CONFIRM_COUNTER_PARTY_INITIATION',
      3,
      async (event, almanac) => {
        console.log('CONFIRM_COUNTER_PARTY_INITIATION')
        if (!this._swap.toFundHash) {
          const { toFundHash, status } = await withInterval(async () =>
            swapProvider.confirmCounterPartyInitiation(fromAccount, toAccount, this._swap)
          )
          this._swap = {
            ...this._swap,
            toFundHash,
            status,
            statusMessage: `Locked ${this._swap.to}`
          }
          this._currentStep++
          if (this._callback) this._callback(this._swap)
        }
        almanac.addRuntimeFact('READY_TO_CLAIM', true)
      },
      (event, almanac) => {
        console.log('READY_TO_CLAIM: failed to process step: ')
        almanac.addRuntimeFact('READY_TO_CLAIM', false)
      }
    )

    const readyToClaimRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'READY_TO_CLAIM',
      2,
      async (event, almanac) => {
        console.log('READY_TO_CLAIM')
        if (!this._swap.toClaimHash) {
          const { toClaimHash, toClaimTx, status } = await swapProvider.claimSwap(fromAccount, toAccount, this._swap)
          this._swap = {
            ...this._swap,
            toClaimHash,
            toClaimTx,
            status,
            statusMessage: `Claiming ${this._swap.to}`
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
      async () => {
        console.log('WAITING_FOR_CLAIM_CONFIRMATIONS')
        if (!this._swap.endTime) {
          const { endTime, status } = await withInterval(async () =>
            swapProvider.waitForClaimConfirmations(fromAccount, toAccount, this._swap)
          )
          this._swap = {
            ...this._swap,
            endTime,
            status
          }
          this._currentStep++
          if (this._callback) this._callback(this._swap)
        }

        // Stop evaluating rules
        this._ruleEngine.stop()
      },
      (event, almanac) => {
        almanac.addRuntimeFact('SUCCESS', false)
      }
    )

    return [
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
