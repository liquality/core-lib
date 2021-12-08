import { ChainNetworkType, IConfig, NetworkEnum } from './types'
import { ChainId } from '@liquality/cryptoassets'
import { BitcoinNetwork, BitcoinNetworks } from '@liquality/bitcoin-networks'
import { EthereumNetwork, EthereumNetworks } from '@liquality/ethereum-networks'

const COIN_GECKO_API = 'https://api.coingecko.com/api/v3'

export const ChainNetworks: Partial<ChainNetworkType> = {
  [ChainId.Bitcoin]: {
    [NetworkEnum.Testnet]: BitcoinNetworks.bitcoin_testnet,
    [NetworkEnum.Mainnet]: BitcoinNetworks.bitcoin
  },
  [ChainId.Ethereum]: {
    [NetworkEnum.Testnet]: EthereumNetworks.ropsten,
    [NetworkEnum.Mainnet]: EthereumNetworks.ethereum_mainnet
  }
}

const DefaultAssets: Record<NetworkEnum, string[]> = {
  mainnet: [
    'BTC',
    'ETH',
    'DAI',
    'USDC',
    'USDT',
    'WBTC',
    'UNI',
    'RBTC',
    'SOV',
    'BNB',
    'NEAR',
    'MATIC',
    'PWETH',
    'ARBETH'
  ],
  // testnet: ['BTC', 'ETH', 'DAI', 'RBTC', 'BNB', 'NEAR', 'SOV', 'MATIC', 'PWETH', 'ARBETH']
  testnet: ['ETH']
}

const DefaultChains: Record<NetworkEnum, ChainId[]> = {
  [NetworkEnum.Mainnet]: [
    ChainId.Bitcoin,
    ChainId.Ethereum,
    ChainId.Rootstock,
    ChainId.BinanceSmartChain,
    ChainId.Near,
    ChainId.Polygon,
    ChainId.Arbitrum
  ],
  [NetworkEnum.Testnet]: [ChainId.Ethereum]
}

const exploraApis: Record<NetworkEnum, string> = {
  [NetworkEnum.Testnet]: 'https://liquality.io/testnet/electrs',
  [NetworkEnum.Mainnet]: 'https://api-mainnet-bitcoin-electrs.liquality.io'
}

const batchEsploraApis = {
  [NetworkEnum.Testnet]: 'https://liquality.io/electrs-testnet-batch',
  [NetworkEnum.Mainnet]: 'https://api-mainnet-bitcoin-electrs-batch.liquality.io'
}

const DefaultNetwork = NetworkEnum.Testnet

const IS_DARK_MODE = false

export class Config implements IConfig {
  private _infuraAPIKey: string

  constructor(infuraAPIKey?) {
    this._infuraAPIKey = infuraAPIKey
  }

  public getEthereumMainnet(): string {
    return `https://mainnet.infura.io/v3/${this._infuraAPIKey}`
  }

  public getEthereumTestnet(): string {
    return `https://ropsten.infura.io/v3/${this._infuraAPIKey}`
  }

  public getBitcoinMainnet(): string {
    return exploraApis[NetworkEnum.Mainnet]
  }

  public getBitcoinTestnet(): string {
    return exploraApis[NetworkEnum.Testnet]
  }

  public getBatchEsploraAPIUrl(network: NetworkEnum): string {
    return batchEsploraApis[network]
  }

  public getChainNetwork(chain: ChainId, network: NetworkEnum): BitcoinNetwork & EthereumNetwork {
    return ChainNetworks[chain][network]
  }

  public getDefaultEnabledChains(network: NetworkEnum) {
    return DefaultChains[network]
  }

  public getDefaultEnabledAssets(network: NetworkEnum): string[] {
    return DefaultAssets[network]
  }

  public getPriceFetcherUrl() {
    return COIN_GECKO_API
  }

  public getDefaultNetwork(): NetworkEnum {
    return DefaultNetwork
  }

  public isDarkMode(): boolean {
    return IS_DARK_MODE
  }
}

export const accountColors = [
  '#000000',
  '#1CE5C3',
  '#007AFF',
  '#4F67E4',
  '#9D4DFA',
  '#D421EB',
  '#FF287D',
  '#FE7F6B',
  '#EAB300',
  '#F7CA4F',
  '#A1E44A',
  '#3AB24D',
  '#8247E5'
]

export const chainDefaultColors: Partial<Record<ChainId, string>> = {
  bitcoin: '#EAB300',
  ethereum: '#4F67E4',
  rsk: '#3AB24D',
  bsc: '#F7CA4F',
  near: '#000000',
  polygon: '#8247E5',
  arbitrum: '#28A0EF'
}

export default {
  defaultAssets: {
    mainnet: [
      'BTC',
      'ETH',
      'DAI',
      'USDC',
      'USDT',
      'WBTC',
      'UNI',
      'RBTC',
      'SOV',
      'BNB',
      'NEAR',
      'MATIC',
      'PWETH',
      'ARBETH'
    ],
    testnet: ['BTC', 'ETH', 'DAI', 'RBTC', 'BNB', 'NEAR', 'SOV', 'MATIC', 'PWETH', 'ARBETH']
  } as Record<NetworkEnum, string[]>,
  infuraApiKey: 'da99ebc8c0964bb8bb757b6f8cc40f1f',
  exploraApis: {
    testnet: 'https://liquality.io/testnet/electrs',
    mainnet: 'https://api-mainnet-bitcoin-electrs.liquality.io'
  },
  batchEsploraApis: {
    testnet: 'https://liquality.io/electrs-testnet-batch',
    mainnet: 'https://api-mainnet-bitcoin-electrs-batch.liquality.io'
  },
  networks: ['mainnet', 'testnet'] as NetworkEnum[],
  chains: ['bitcoin', 'ethereum', 'rsk', 'bsc', 'near', 'polygon', 'arbitrum'] as ChainId[]
}
