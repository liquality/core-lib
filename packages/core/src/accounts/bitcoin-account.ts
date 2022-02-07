import {
  AccountType,
  Hardware,
  IAccount,
  IAsset,
  IConfig,
  Mnemonic,
  NetworkEnum,
  StateType,
  TriggerType
} from '../types'
import { ChainId, chains, assets as cryptoassets } from '@liquality/cryptoassets'
import { Client } from '@liquality/client'
import { Address, BigNumber, bitcoin, FeeDetails, Transaction } from '@liquality/types'
import axios from 'axios'
import { BitcoinEsploraBatchApiProvider } from '@liquality/bitcoin-esplora-batch-api-provider'
import { BitcoinJsWalletProvider } from '@liquality/bitcoin-js-wallet-provider'
import { BitcoinRpcFeeProvider } from '@liquality/bitcoin-rpc-fee-provider'
import { BitcoinFeeApiProvider } from '@liquality/bitcoin-fee-api-provider'
import { BitcoinSwapProvider } from '@liquality/bitcoin-swap-provider'
import { BitcoinEsploraSwapFindProvider } from '@liquality/bitcoin-esplora-swap-find-provider'

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
  private _callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>>

  constructor(
    config: IConfig,
    mnemonic: Mnemonic,
    index: number,
    chain: ChainId,
    network: NetworkEnum,
    assetSymbols: string[],
    callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>>,
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
    this._callbacks = callbacks
    this._client = this.createBtcClient()
  }

  public async build(): Promise<AccountType> {
    if (!this._address) {
      await this.getUsedAddress()
    }

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
    return Promise.resolve([])
  }

  public async getUnusedAddress(): Promise<Address> {
    return await this._client.wallet.getUnusedAddress()
  }

  public async getUsedAddress(): Promise<Address> {
    if (this._address) return this._address
    const addresses = await this._client.wallet.getUsedAddresses(100)
    if (addresses.length == 0) {
      const unusedAddress = await this.getUnusedAddress()
      console.log('unused address: ', unusedAddress)
      if (!unusedAddress) {
        throw new Error('No Bitcoin addresses found')
      } else {
        this._address = unusedAddress
      }
    } else {
      console.log('used address: ', addresses[0])
      this._address = addresses[0]
    }
    return this._address
  }

  public async getBalance(): Promise<BigNumber> {
    const addresses = await this._client.wallet.getUsedAddresses(100)
    if (!addresses) return new BigNumber(0)
    return await this._client.chain.getBalance(addresses)
  }

  public async getFeeDetails(): Promise<FeeDetails> {
    return await this._client.chain.getFees()
  }

  public getPrivateKey(): Promise<string> {
    return Promise.resolve('')
  }

  public getPublicKey(): Promise<string> {
    return Promise.resolve('')
  }

  public async refresh(): Promise<AccountType> {
    return this.toAccount()
  }

  public async fetchPricesForAssets(toCurrency: string): Promise<StateType['fiatRates']> {
    const baseCurrency = cryptoassets[ASSET]?.coinGeckoId
    if (!baseCurrency) {
      throw new Error('asset not supported')
    }

    const { data } = await axios.get(`${this._config.getPriceFetcherUrl()}/simple/price`, {
      params: { vs_currencies: toCurrency, ids: baseCurrency }
    })

    return {
      BTC: data[baseCurrency][toCurrency.toLowerCase()]
    }
  }

  public getClient(): Client {
    return this._client
  }

  public async speedUpTransaction(transaction: string | Transaction, newFee: number): Promise<Transaction> {
    return await this._client.chain.updateTransactionFee(transaction, newFee)
  }

  private async toAccount(): Promise<AccountType> {
    const balance = await this.getBalance().catch((error) => {
      console.log(`BTC balance error: ${error}`)
    })
    const fiatRates = await this.fetchPricesForAssets('usd').catch((error) => {
      console.log(`BTC fiat rates error: ${error}`)
    })
    const feeDetails = await this.getFeeDetails().catch((error) => {
      console.log(`fee details error: ${error}`)
    })

    const account: AccountType = {
      name: `${chains[this._chain]?.name} 1`,
      chain: this._chain,
      type: 'default',
      index: 0,
      assets: [],
      addresses: [this._address.address],
      balances: {
        [ASSET]: (balance || new BigNumber(0)).toNumber()
      },
      color: '#FFF',
      createdAt: this._at,
      updatedAt: this._at
    }

    if (fiatRates) account.fiatRates = fiatRates
    if (feeDetails) account.feeDetails = feeDetails

    return account
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

    const options = {
      network: bitcoinNetwork,
      mnemonic: this._mnemonic,
      baseDerivationPath: this._derivationPath,
      addressType: bitcoin.AddressType.BECH32
    }

    //TODO fix this issue in the original repo
    // @ts-ignore
    btcClient.addProvider(new BitcoinJsWalletProvider(options))
    btcClient.addProvider(new BitcoinSwapProvider({ network: bitcoinNetwork }))
    btcClient.addProvider(new BitcoinEsploraSwapFindProvider(esploraApi))

    if (isTestnet) {
      btcClient.addProvider(new BitcoinRpcFeeProvider())
    } else {
      btcClient.addProvider(new BitcoinFeeApiProvider(this._config.getBitcoinFeeUrl()))
    }

    return btcClient
  }
}
