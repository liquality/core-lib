import { HistoryItem, IAsset, TriggerType } from './types'
import { BigNumber, SendOptions, Transaction } from '@liquality/types'
import { Client } from '@liquality/client'
import { isEthereumChain, assets as cryptoassets } from '@liquality/cryptoassets'
import { v4 as uuidv4 } from 'uuid'

export default class Asset implements IAsset {
  private readonly _symbol: string
  private readonly _address: string
  private readonly _client: Client
  private readonly _callbacks: Partial<Record<TriggerType, (historyItem: HistoryItem) => void>>

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
      toAddress: typeof options.to === 'string' ? options.to : options.to.address,
      totalSteps: 2,
      currentStep: 1,
      type: 'SEND'
    }
    this._callbacks['onTransactionUpdate']?.(historyItem)
    return historyItem
  }

  public getClient(): Client {
    return this._client
  }
}
