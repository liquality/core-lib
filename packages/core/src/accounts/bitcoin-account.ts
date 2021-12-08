import { AccountType, Hardware, IAccount, IAsset, IConfig, Mnemonic, NetworkEnum, StateType } from '../types'
import { ChainId, chains } from '@liquality/cryptoassets'
import { Client } from '@liquality/client'
import { Address, BigNumber, bitcoin, FeeDetails } from '@liquality/types'
import Asset from '../asset'
import axios from 'axios'
import { BitcoinEsploraBatchApiProvider } from '@liquality/bitcoin-esplora-batch-api-provider'
import { BitcoinJsWalletProvider } from '@liquality/bitcoin-js-wallet-provider'
import { BitcoinRpcFeeProvider } from '@liquality/bitcoin-rpc-fee-provider'
import { BitcoinFeeApiProvider } from '@liquality/bitcoin-fee-api-provider'
import { BitcoinNetwork } from '@liquality/bitcoin-networks'

const ASSET = 'BTC'

export default class BitcoinAccount implements IAccount {
  private _mnemonic: Mnemonic
  private _index: number
  private _name: string
  private _chain: ChainId
  private _network: NetworkEnum
  private _hardware: Hardware
  private _client: Client
  private _derivationPath: string
  private _address: Address
  private _assets: IAsset[]
  private _balance: BigNumber
  private _config: IConfig
  private _at: number

  constructor(
    config: IConfig,
    mnemonic: Mnemonic,
    index: number,
    chain: ChainId,
    network: NetworkEnum,
    assetSymbols: string[],
    hardware?: Hardware
  ) {
    if (!mnemonic) {
      throw new Error('Unable to generate address. Mnemonic missing')
    }

    this._config = config
    this._mnemonic = mnemonic
    this._index = index
    this._name = `${chains[chain].name} ${index}`
    this._chain = chain
    this._network = network
    this._hardware = hardware
    this._at = Date.now()
    this._assets = []
    this._derivationPath = this.calculateDerivationPath()
    this._client = this.createBtcClient()
  }

  public async build(): Promise<AccountType> {
    await this.getUnusedAddress()
    await this.getAssets()

    return this.toAccount()
  }

  public calculateDerivationPath(): string {
    const bitcoinNetwork = this._config.getChainNetwork(this._chain, this._network)
    const BTC_ADDRESS_TYPE_TO_PREFIX = {
      legacy: 44,
      'p2sh-segwit': 49,
      bech32: 84
    }

    return `${BTC_ADDRESS_TYPE_TO_PREFIX[bitcoin.AddressType.BECH32]}'/${bitcoinNetwork.coinType}'/${this._index}'`
  }

  public getAssets(): Promise<IAsset[]> {
    if (this._assets.length > 0) return Promise.resolve(this._assets)
    return Promise.resolve([new Asset(ASSET, this._address, this._client)])
  }

  public async getUnusedAddress(): Promise<Address> {
    if (this._address) return Promise.resolve(this._address)
    return (this._address = await this._client.wallet.getUnusedAddress())
  }

  public getUsedAddress(): Address {
    return this._address
  }

  public async getBalance(): Promise<BigNumber> {
    if (!this._address) await this.getUnusedAddress()
    return await this._client.chain.getBalance([this._address])
  }

  public async getFeeDetails(): Promise<FeeDetails> {
    return await this._client.chain.getFees()
  }

  getPrivateKey(): Promise<string> {
    return Promise.resolve('')
  }

  getPublicKey(): Promise<string> {
    return Promise.resolve('')
  }

  public async refresh(): Promise<AccountType> {
    return this.toAccount()
  }

  public async fetchPricesForAssets(toCurrency: string): Promise<StateType['fiatRates']> {
    const requestUrl = `${this._config.getPriceFetcherUrl()}/simple/price?ids=BTC&vs_currencies=${toCurrency}`
    const { data } = await axios.get(requestUrl)

    return {
      BTC: data[data.coinGeckoId][toCurrency.toLowerCase()]
    }
  }

  private async toAccount(): Promise<AccountType> {
    return {
      name: `${chains[this._chain]?.name} 1`,
      chain: this._chain,
      type: 'default',
      index: 0,
      assets: [ASSET],
      addresses: [this._address.address],
      balances: {
        [ASSET]: (await this._assets[0].getBalance()).toNumber()
      },
      fiatRates: await this.fetchPricesForAssets('usd'),
      feeDetails: await this.getFeeDetails(),
      color: '#FFF',
      createdAt: this._at,
      updatedAt: this._at
    }
  }

  private createBtcClient() {
    const isTestnet = this._network === NetworkEnum.Testnet
    const bitcoinNetwork = this._config.getChainNetwork(ChainId.Bitcoin, this._network)
    const esploraApi = isTestnet ? this._config.getBitcoinTestnet() : this._config.getBitcoinMainnet()
    const batchEsploraApi = this._config.getBatchEsploraAPIUrl(this._network)

    const btcClient = new Client()
    btcClient.addProvider(
      new BitcoinEsploraBatchApiProvider({
        batchUrl: batchEsploraApi,
        url: esploraApi,
        network: bitcoinNetwork,
        numberOfBlockConfirmation: 2
      })
    )

    const options: {
      network: BitcoinNetwork
      mnemonic: string
      baseDerivationPath: string
      addressType?: bitcoin.AddressType
    } = {
      network: bitcoinNetwork,
      mnemonic: this._mnemonic,
      baseDerivationPath: this._derivationPath,
      addressType: bitcoin.AddressType.BECH32
    }

    //TODO fix this issue in the original repo
    // @ts-ignore
    btcClient.addProvider(new BitcoinJsWalletProvider(options))

    if (isTestnet) {
      btcClient.addProvider(new BitcoinRpcFeeProvider())
    } else {
      btcClient.addProvider(new BitcoinFeeApiProvider('https://liquality.io/swap/mempool/v1/fees/recommended'))
    }

    return btcClient
  }
}
