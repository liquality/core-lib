import { v4 as uuidv4 } from 'uuid'
import { Engine, RuleProperties } from 'json-rules-engine'
import { Transaction } from '@liquality/types'
import { Client } from '@liquality/client'
import { HistoryItem, IRuleEngine } from '../types'
import { withInterval } from '../utils'
import { chains, assets as cryptoassets } from '@liquality/cryptoassets'

class SendRuleEngine implements IRuleEngine {
  private readonly _ruleEngine: Engine
  private readonly _asset: string
  private readonly _transaction: Transaction
  private readonly _client: Client
  private _currentStep: number
  private readonly _callback: (transaction: Transaction, status: string) => void
  private readonly _totalSteps = 2
  private readonly _transactionId
  private readonly _startTime

  constructor(asset: string, client: Client, transaction: Transaction, callback: (historyItem: HistoryItem) => void) {
    this._asset = asset
    this._client = client
    this._transaction = transaction
    this._currentStep = 1
    this._transactionId = uuidv4()
    this._startTime = Date.now()
    this._callback = (payload: Transaction, status: string) => {
      callback({
        id: this._transactionId,
        from: asset,
        to: asset,
        fromAddress: payload._raw.to,
        toAddress: payload._raw.to,
        startTime: this._startTime,
        totalSteps: this._totalSteps,
        sendTransaction: payload,
        type: 'SEND',
        currentStep: this._currentStep,
        status,
        endTime: Date.now()
      })
    }
    this._ruleEngine = new Engine(this.getRules())
  }

  public getTotalSteps(): number {
    return 2
  }

  private getRules = (): RuleProperties[] => {
    const initiatedRule: RuleProperties = SendRuleEngine.buildRule(
      'INITIATED',
      1,
      async () => {
        await withInterval(async () => {
          console.log('checking confirmations')
          try {
            const response = await this._client.chain.getTransactionByHash(this._transaction.hash)

            if (response) {
              console.log('confirmations: ', response.confirmations)
              const confirmations = response.confirmations || 0
              let status = 'INITIATED'

              if (confirmations >= chains[cryptoassets[this._asset].chain].safeConfirmations) {
                status = 'SUCCESS'
                this._currentStep++
              }
              if (this._callback) {
                this._callback(response, status)
              }

              return status === 'SUCCESS'
            }
          } catch (e) {
            if (e.name === 'TxNotFoundError') console.warn(e)
            else throw e
          }
        })
      },
      () => {
        throw new Error('Rule trigger invalid')
      }
    )

    return [initiatedRule]
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

  public async start(): Promise<void> {
    console.log('Starting a send rule engine...')
    const fact = {
      INITIATED: true
    }

    await this._ruleEngine.run(fact)
  }
}

export default SendRuleEngine
