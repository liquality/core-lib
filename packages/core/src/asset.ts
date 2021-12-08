import { IAsset, Token } from './types'
import { Address, BigNumber, SendOptions, Transaction } from '@liquality/types'
import { Client } from '@liquality/client'
import { isEthereumChain, assets as cryptoassets } from '@liquality/cryptoassets'

export default class Asset implements IAsset {
  _balance: BigNumber
  _symbol: string
  _type: Token
  _addressObject: Address
  _client: Client

  constructor(symbol: string, addressObject: Address, client: Client) {
    this._symbol = symbol
    this._addressObject = addressObject
    this._client = client
  }

  public getAddress(): string {
    return this._addressObject.address
  }

  getSymbol(): string {
    return this._symbol
  }

  public async getBalance(): Promise<BigNumber> {
    const address = isEthereumChain(cryptoassets[this._symbol].chain)
      ? this._addressObject.address.replace('0x', '')
      : this._addressObject.address // TODO: Should not require removing 0x
    return await this._client.chain.getBalance([address])
  }

  public getPastTransactions(): Promise<Transaction[]> {
    return Promise.resolve([])
  }

  public async transmit(options: SendOptions): Promise<Transaction> {
    return await this._client.chain.sendTransaction(options)
  }
}
