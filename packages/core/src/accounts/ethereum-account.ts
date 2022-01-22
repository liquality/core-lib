import { AccountType, Hardware, IAccount, IAsset, IConfig, Mnemonic, StateType } from '../types'
import { ChainId, assets as cryptoassets, chains, isEthereumChain } from '@liquality/cryptoassets'
import { NetworkEnum } from '../types'
import { Client } from '@liquality/client'
import { Address, BigNumber, FeeDetails } from '@liquality/types'
import { EthereumRpcFeeProvider } from '@liquality/ethereum-rpc-fee-provider'
import { EthereumGasNowFeeProvider } from '@liquality/ethereum-gas-now-fee-provider'
import { EthereumNetwork } from '@liquality/ethereum-networks'
import { EthereumRpcProvider } from '@liquality/ethereum-rpc-provider'
import { EthereumJsWalletProvider } from '@liquality/ethereum-js-wallet-provider'
import Asset from '../asset'
import { EthereumErc20Provider } from '@liquality/ethereum-erc20-provider'
import axios from 'axios'
import { EthereumErc20SwapProvider } from '@liquality/ethereum-erc20-swap-provider'
import { EthereumErc20ScraperSwapFindProvider } from '@liquality/ethereum-erc20-scraper-swap-find-provider'
import { EthereumSwapProvider } from '@liquality/ethereum-swap-provider'
import { EthereumScraperSwapFindProvider } from '@liquality/ethereum-scraper-swap-find-provider'

export default class EthereumAccount implements IAccount {
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

    const isTestnet = network === NetworkEnum.Testnet
    const ethereumNetwork = config.getChainNetwork(chain, network)
    const infuraApi = isTestnet ? config.getEthereumTestnet() : config.getEthereumMainnet()
    const feeProvider = isTestnet ? new EthereumRpcFeeProvider() : new EthereumGasNowFeeProvider()
    const scraperApi = isTestnet
      ? 'https://liquality.io/arbitrum-testnet-api'
      : 'https://liquality.io/arbitrum-mainnet-api'

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
    this._client = EthereumAccount.createEthereumClient(
      ethereumNetwork as EthereumNetwork,
      infuraApi,
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
    await this.getAssets()
    const fiatRates = await this.fetchPricesForAssets('usd')
    const feeDetails = await this.getFeeDetails()

    for (const asset of this._assets) {
      assets.push(asset.getSymbol())
      addresses.push(asset.getAddress())
      balances[asset.getSymbol()] = (await asset.getBalance()).toNumber()
    }

    return {
      name: `${chains[this._chain]?.name} 1`,
      chain: this._chain,
      type: 'default',
      index: 0,
      assets,
      addresses,
      balances,
      fiatRates,
      feeDetails,
      color: '#FFF',
      createdAt: this._at,
      updatedAt: this._at
    }
  }

  public async getAssets(): Promise<IAsset[]> {
    if (!this._address) await this.getUsedAddress()
    const isTestnet = this._network === NetworkEnum.Testnet
    const ethereumNetwork = this._config.getChainNetwork(this._chain, this._network)
    const infuraApi = isTestnet ? this._config.getEthereumTestnet() : this._config.getEthereumMainnet()
    const feeProvider = isTestnet ? new EthereumRpcFeeProvider() : new EthereumGasNowFeeProvider()
    const scraperApi = isTestnet
      ? 'https://liquality.io/arbitrum-testnet-api'
      : 'https://liquality.io/arbitrum-mainnet-api'

    const _assetSymbols = this._config.getDefaultEnabledAssets(this._network)
    this._assets = _assetSymbols
      .filter((asset) => {
        return cryptoassets[asset]?.chain === this._chain
      })
      .map((asset) => {
        const client = EthereumAccount.createEthereumClient(
          ethereumNetwork,
          infuraApi,
          scraperApi,
          feeProvider,
          this._mnemonic,
          this._derivationPath,
          asset
        )
        return new Asset(asset, this._address.address, client)
      })
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
    if (addresses.length == 0) throw new Error('No addresses found')
    this._address = addresses[0]
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

  private static createEthereumClient(
    ethereumNetwork: EthereumNetwork,
    rpcApi: string,
    scraperApi: string,
    feeProvider: EthereumRpcFeeProvider | EthereumGasNowFeeProvider,
    mnemonic: string,
    derivationPath: string,
    asset?: string
  ) {
    const ethClient = new Client()
    ethClient.addProvider(new EthereumRpcProvider({ uri: rpcApi }))

    ethClient.addProvider(
      new EthereumJsWalletProvider({
        network: ethereumNetwork,
        mnemonic,
        derivationPath
      })
    )

    if (asset && cryptoassets[asset]?.type === 'erc20') {
      const contractAddress = cryptoassets[asset].contractAddress
      ethClient.addProvider(new EthereumErc20Provider(contractAddress))
      ethClient.addProvider(new EthereumErc20SwapProvider())
      if (scraperApi) ethClient.addProvider(new EthereumErc20ScraperSwapFindProvider(scraperApi))
    } else {
      ethClient.addProvider(new EthereumSwapProvider())
      if (scraperApi) ethClient.addProvider(new EthereumScraperSwapFindProvider(scraperApi))
    }

    ethClient.addProvider(feeProvider)
    return ethClient
  }
}
