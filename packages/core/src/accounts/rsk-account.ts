import { AccountType, Hardware, IAccount, IAsset, IConfig, Mnemonic, StateType, TriggerType } from '../types'
import { ChainId, assets as cryptoassets, chains, isEthereumChain } from '@liquality/cryptoassets'
import { NetworkEnum } from '../types'
import { Client } from '@liquality/client'
import { Address, BigNumber, FeeDetails, Transaction } from '@liquality/types'
import { EthereumRpcFeeProvider } from '@liquality/ethereum-rpc-fee-provider'
import { EthereumRpcProvider } from '@liquality/ethereum-rpc-provider'
import { EthereumJsWalletProvider } from '@liquality/ethereum-js-wallet-provider'
import Asset from '../asset'
import { EthereumErc20Provider } from '@liquality/ethereum-erc20-provider'
import axios from 'axios'
import { EthereumErc20SwapProvider } from '@liquality/ethereum-erc20-swap-provider'
import { EthereumErc20ScraperSwapFindProvider } from '@liquality/ethereum-erc20-scraper-swap-find-provider'
import { EthereumSwapProvider } from '@liquality/ethereum-swap-provider'
import { EthereumScraperSwapFindProvider } from '@liquality/ethereum-scraper-swap-find-provider'
import { EthereumNetwork } from '@liquality/ethereum-networks'
import { EthereumGasNowFeeProvider } from '@liquality/ethereum-gas-now-fee-provider'

export default class RSKAccount implements IAccount {
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
    console.log('creating RSKAccount...')
    if (!mnemonic) {
      throw new Error('Unable to generate address. Mnemonic missing')
    }

    const rskNetwork = config.getChainNetwork(chain, network)
    const rpcApi = config.getSovrynRPCAPIUrl(network)
    const feeProvider = new EthereumRpcFeeProvider({ slowMultiplier: 1, averageMultiplier: 1, fastMultiplier: 1.25 })
    const scraperApi = config.getRSKScraperApi(network)

    this._config = config
    this._mnemonic = mnemonic
    this._index = index
    this._name = `${chains[chain].name} ${index}`
    this._chain = chain
    this._network = network
    this._hardware = hardware
    this._at = Date.now()
    this._assets = []
    this._callbacks = callbacks
    this._derivationPath = this.calculateDerivationPath()
    this._client = this.createRSKClient(
      rskNetwork,
      rpcApi,
      scraperApi,
      feeProvider,
      this._mnemonic,
      this._derivationPath
    )
  }

  public async build(): Promise<AccountType> {
    const assets: string[] = []
    const addresses: string[] = []
    const balances: Record<string, number> = {}

    await this.getUsedAddress()
    await this.buildAssets()
    const fiatRates = await this.fetchPricesForAssets('usd').catch((error) => {
      console.log(`RSK fiat rates error: ${error}`)
    })
    const feeDetails = await this.getFeeDetails().catch((error) => {
      console.log(`Rootstock fee details error: ${error}`)
    })

    for (const asset of this._assets) {
      assets.push(asset.getSymbol())
      addresses.push(asset.getAddress())
      balances[asset.getSymbol()] = (await asset.getBalance()).toNumber()
    }

    const account: AccountType = {
      name: `${chains[this._chain]?.name} 1`,
      chain: this._chain,
      type: 'default',
      index: 0,
      assets,
      addresses,
      balances,
      color: '#FFF',
      createdAt: this._at,
      updatedAt: this._at
    }

    if (fiatRates) account.fiatRates = fiatRates
    if (feeDetails) account.feeDetails = feeDetails

    return account
  }

  public getAssets(): IAsset[] {
    return this._assets
  }

  public getPrivateKey(): Promise<string> {
    return Promise.resolve('')
  }

  public getPublicKey(): Promise<string> {
    return Promise.resolve('')
  }

  public async getUnusedAddress(): Promise<Address> {
    return await this._client.wallet.getUnusedAddress()
  }

  public async getUsedAddress(): Promise<Address> {
    if (this._address) return this._address
    const addresses = await this._client.wallet.getUsedAddresses(100)
    if (addresses.length == 0) {
      const unusedAddress = await this.getUnusedAddress()

      if (!unusedAddress) {
        throw new Error('No Ethereum addresses found')
      } else {
        this._address = unusedAddress
      }
    } else {
      this._address = addresses[0]
    }
    return this._address
  }

  public async getBalance(): Promise<BigNumber> {
    if (!this._address) await this.getUsedAddress()
    return await this._client.chain.getBalance([this._address])
  }

  public async getFeeDetails(): Promise<FeeDetails> {
    return await this._client.chain.getFees()
  }

  public calculateDerivationPath(): string {
    const ethNetwork = this._config.getChainNetwork(this._chain, this._network)
    return `m/44'/${ethNetwork.coinType}'/${this._index}'/0/0`
  }

  public async fetchPricesForAssets(toCurrency: string): Promise<StateType['fiatRates']> {
    const baseCurrencies = this._config.getDefaultEnabledAssets(this._network)
    const reverseMap: Record<string, string> = {}
    const coindIds = baseCurrencies
      .filter((currency) => cryptoassets[currency]?.coinGeckoId && isEthereumChain(cryptoassets[currency].chain))
      .map((currency) => {
        reverseMap[cryptoassets[currency].coinGeckoId] = currency
        return cryptoassets[currency].coinGeckoId
      })
    const { data } = await axios.get(`${this._config.getPriceFetcherUrl()}/simple/price`, {
      params: { vs_currencies: toCurrency, ids: coindIds.join(',') }
    })
    return Object.keys(data).reduce((acc: Record<string, number>, coinGeckoId) => {
      acc[reverseMap[coinGeckoId]] = data[coinGeckoId][toCurrency.toLowerCase()]
      return acc
    }, {})
  }

  public async refresh(): Promise<AccountType> {
    const assets: string[] = []
    const addresses: string[] = []
    const balances: Record<string, number> = {}

    for (const asset of this._assets) {
      assets.push(asset.getSymbol())
      addresses.push(asset.getAddress())
      balances[asset.getSymbol()] = (await asset.getBalance()).toNumber()
    }

    return {
      name: `${chains[this._chain]?.name} 1`,
      chain: this._chain,
      type: 'default',
      index: this._index,
      assets,
      addresses,
      balances,
      fiatRates: await this.fetchPricesForAssets('usd'),
      feeDetails: await this.getFeeDetails(),
      color: '#FFF',
      createdAt: this._at,
      updatedAt: Date.now()
    }
  }

  public getClient(): Client {
    return this._client
  }

  public async speedUpTransaction(transaction: string | Transaction, newFee: number): Promise<Transaction> {
    return await this._client.chain.updateTransactionFee(transaction, newFee)
  }

  private async buildAssets(): Promise<IAsset[]> {
    const _assetSymbols = this._config.getDefaultEnabledAssets(this._network)
    const rskNetwork = this._config.getChainNetwork(this._chain, this._network)
    const rpcApi = this._config.getSovrynRPCAPIUrl(this._network)
    const feeProvider = new EthereumRpcFeeProvider({ slowMultiplier: 1, averageMultiplier: 1, fastMultiplier: 1.25 })
    const scraperApi = this._config.getRSKScraperApi(this._network)

    this._assets = _assetSymbols
      .filter((asset) => {
        return cryptoassets[asset]?.chain === this._chain
      })
      .map((asset) => {
        const client = this.createRSKClient(
          rskNetwork,
          rpcApi,
          scraperApi,
          feeProvider,
          this._mnemonic,
          this._derivationPath,
          asset
        )
        return new Asset(asset, this._address.address, client, this._callbacks)
      })
    return this._assets
  }

  private createRSKClient(
    rskNetwork: EthereumNetwork,
    rpcApi: string,
    scraperApi: string,
    feeProvider: EthereumRpcFeeProvider | EthereumGasNowFeeProvider,
    mnemonic: string,
    derivationPath: string,
    asset?: string
  ) {
    const ethClient = new Client()
    ethClient.addProvider(new EthereumRpcProvider({ uri: rpcApi }))
    ethClient.addProvider(feeProvider)
    ethClient.addProvider(
      new EthereumJsWalletProvider({
        network: rskNetwork,
        mnemonic,
        derivationPath
      })
    )

    if (asset && cryptoassets[asset]?.type === 'erc20') {
      const contractAddress = rskNetwork.isTestnet
        ? this._config.getTestnetContractAddress(asset)
        : cryptoassets[asset].contractAddress
      console.log('---->', rskNetwork.isTestnet, asset && cryptoassets[asset]?.type, contractAddress)
      ethClient.addProvider(new EthereumErc20Provider(contractAddress))
      ethClient.addProvider(new EthereumErc20SwapProvider())
      if (scraperApi) ethClient.addProvider(new EthereumErc20ScraperSwapFindProvider(scraperApi))
    } else {
      ethClient.addProvider(new EthereumSwapProvider())
      if (scraperApi) ethClient.addProvider(new EthereumScraperSwapFindProvider(scraperApi))
    }

    return ethClient
  }
}
