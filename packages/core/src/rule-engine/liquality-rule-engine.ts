import { Engine, RuleProperties } from 'json-rules-engine'
import { IAccount, SwapTransactionType } from '../types'
import LiqualitySwapProvider from '../swaps/liquality-swap-provider'

const withInterval = async (func: () => unknown): Promise<Partial<SwapTransactionType>> => {
  const updates = await func()
  if (updates) {
    return updates
  }
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const updates = await func()
        if (updates) {
          clearInterval(interval)
          resolve(updates)
        }
      } catch (e) {
        reject(`Failed to run: ${func.name}`)
      }
    }, 15000 * Math.random() + 15000)
  })
}

/**
 * A rule engine that makes sure an atomic swap is executed all the way to the end
 * We need to pass a fact with an EXPIRATION status to start the engine, and the engine
 * takes care of moving the transaction through all the steps
 */
class LiqualityRuleEngine {
  private _ruleEngine: Engine
  private _fromAccount: IAccount
  private _toAccount: IAccount
  private _swapProvider: LiqualitySwapProvider
  private _swap: Partial<SwapTransactionType>
  private _callback: (...args: unknown[]) => void

  constructor(
    fromAccount: IAccount,
    toAccount: IAccount,
    swapProvider: LiqualitySwapProvider,
    swap: Partial<SwapTransactionType>,
    callback: (...args: unknown[]) => void
  ) {
    this._fromAccount = fromAccount
    this._toAccount = toAccount
    this._swapProvider = swapProvider
    this._swap = swap
    this._callback = callback
    this._ruleEngine = new Engine(this.getRules(toAccount, fromAccount, swapProvider, swap))
  }

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

  private getRules = (
    toAccount: IAccount,
    fromAccount: IAccount,
    swapProvider: LiqualitySwapProvider,
    swap: Partial<SwapTransactionType>
  ): RuleProperties[] => {
    const expirationRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'EXPIRATION',
      11,
      async (event, almanac) => {
        const hasSwapExpired = await swapProvider.hasSwapExpired(fromAccount, swap)
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
        await swapProvider.waitForRefund(fromAccount, swap)
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
        const { refundHash, status } = await swapProvider.refundSwap(fromAccount, swap)
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
        const confirmation = await withInterval(async () => swapProvider.waitForRefundConfirmations(fromAccount, swap))
        this._swap = {
          ...this._swap,
          ...confirmation
        }
        if (this._callback) this._callback(this._swap)
      },
      () => {
        // Dispatch that the swap refund has failed
      }
    )

    const initiatedRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'INITIATED',
      7,
      async (event, almanac) => {
        await swapProvider.updateOrder(swap)
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
        const confirmation = await withInterval(async () =>
          swapProvider.confirmInitiation(fromAccount, toAccount, swap)
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
      },
      function (event, almanac) {
        almanac.addRuntimeFact('INITIATION_CONFIRMED', false)
      }
    )

    const initiationConfirmedRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'INITIATION_CONFIRMED',
      5,
      async (event, almanac) => {
        const { fundTxHash, status } = await swapProvider.fundSwap(fromAccount, swap)
        this._swap = {
          ...this._swap,
          fundTxHash,
          status
        }
        if (this._callback) this._callback(this._swap)
        almanac.addRuntimeFact('FUNDED', true)
      },
      function (event, almanac) {
        almanac.addRuntimeFact('FUNDED', false)
      }
    )

    const fundedRule: RuleProperties = LiqualityRuleEngine.buildRule(
      'FUNDED',
      4,
      async (event, almanac) => {
        const { toFundHash, status } = await withInterval(async () =>
          swapProvider.findCounterPartyInitiation(toAccount, swap)
        )
        this._swap = {
          ...this._swap,
          toFundHash,
          status
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
        const { toFundHash, status } = await withInterval(async () =>
          swapProvider.findCounterPartyInitiation(toAccount, swap)
        )
        this._swap = {
          ...this._swap,
          toFundHash,
          status
        }
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
        const { toClaimHash, toClaimTx, status } = await swapProvider.claimSwap(toAccount, swap)
        this._swap = {
          ...this._swap,
          toClaimHash,
          toClaimTx,
          status
        }
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
        const { endTime, status } = await withInterval(async () =>
          swapProvider.waitForClaimConfirmations(toAccount, swap)
        )
        this._swap = {
          ...this._swap,
          endTime,
          status
        }
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

  public async start() {
    const fact = {
      EXPIRATION: true
    }

    await this._ruleEngine.run(fact)
  }
}

export default LiqualityRuleEngine
