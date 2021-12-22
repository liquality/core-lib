import { IAsset, Token } from './types'
import { BigNumber, SendOptions, Transaction } from '@liquality/types'
import { Client } from '@liquality/client'
import { isEthereumChain, assets as cryptoassets } from '@liquality/cryptoassets'

export default class Asset implements IAsset {
  _balance: BigNumber
  _symbol: string
  _type: Token
  _address: string
  _client: Client

  constructor(symbol: string, address: string, client: Client) {
    this._symbol = symbol
    this._address = address
    this._client = client
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

  public async transmit(options: SendOptions): Promise<Transaction> {
    return await this._client.chain.sendTransaction(options)
  }

  public getClient(): Client {
    return this._client
  }
}
