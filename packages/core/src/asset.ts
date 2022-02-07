import { HistoryItem, IAsset, TriggerType } from './types'
import { BigNumber, SendOptions, Transaction } from '@liquality/types'
import { Client } from '@liquality/client'
import { isEthereumChain, assets as cryptoassets } from '@liquality/cryptoassets'
import { v4 as uuidv4 } from 'uuid'
import SendRuleEngine from './rule-engine/send-rule-engine'
import { Mutex } from 'async-mutex'

export default class Asset implements IAsset {
  private readonly _symbol: string
  private readonly _address: string
  private readonly _client: Client
  private readonly _callbacks: Partial<Record<TriggerType, (historyItem: HistoryItem) => void>>
  private _mutex: Mutex

  constructor(
    symbol: string,
    address: string,
    client: Client,
    callbacks: Partial<Record<TriggerType, (historyItem: HistoryItem) => void>>
  ) {
    this._symbol = symbol
    this._address = address
    this._client = client
    this._callbacks = callbacks
    this._mutex = new Mutex()
  }

  public getAddress(): string {
    return this._address
  }

  getSymbol(): string {
    return this._symbol
  }

  public async getBalance(): Promise<BigNumber> {
    const address = isEthereumChain(cryptoassets[this._symbol].chain) ? this._address.replace('0x', '') : this._address // TODO: Should not require removing 0x
    return await this._client.chain.getBalance([address])
  }

  public getPastTransactions(): Promise<Transaction[]> {
    return Promise.resolve([])
  }

  public async transmit(options: SendOptions): Promise<HistoryItem> {
    const transaction = await this._client.chain.sendTransaction(options)
    const historyItem: HistoryItem = {
      id: uuidv4(),
      sendTransaction: transaction,
      startTime: Date.now(),
      from: this._symbol,
      to: this._symbol,
      fromAddress: this._address,
      toAddress: typeof options.to === 'string' ? options.to : options.to.address,
      totalSteps: 2,
      currentStep: 1,
      type: 'SEND',
      status: 'INITIATED'
    }
    this._callbacks['onTransactionUpdate']?.(historyItem)
    this.runRulesEngine(transaction)
    return historyItem
  }

  public runRulesEngine(transaction: Transaction): void {
    if (!this._mutex.isLocked()) {
      //Makes sure we can only run one instance of the rule engine at any given time for a given swap provider
      this._mutex.runExclusive(() => {
        new SendRuleEngine(this._symbol, this._client, transaction, this._callbacks['onTransactionUpdate']).start()
      })
    } else {
      throw new Error('Rules Engine already running for this provider')
    }
  }

  public getClient(): Client {
    return this._client
  }
}
