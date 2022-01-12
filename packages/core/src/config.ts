import { ChainNetworkType, IConfig, NetworkEnum, SwapProvidersEnum, SwapProviderType } from './types'
import { ChainId } from '@liquality/cryptoassets'
import { BitcoinNetwork, BitcoinNetworks } from '@liquality/bitcoin-networks'
import { EthereumNetwork, EthereumNetworks } from '@liquality/ethereum-networks'
import SovrynMainnetAddresses from '@blobfishkate/sovryncontracts/contracts-mainnet.json'
import SovrynTestnetAddresses from '@blobfishkate/sovryncontracts/contracts-testnet.json'

const COIN_GECKO_API = 'https://api.coingecko.com/api/v3'

const TESTNET_CONTRACT_ADDRESSES = {
  DAI: '0xad6d458402f60fd3bd25163575031acdce07538d',
  SOV: '0x6a9A07972D07E58f0daF5122D11e069288A375fB',
  PWETH: '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa',
  SUSHI: '0x0769fd68dFb93167989C6f7254cd0D766Fb2841F',
  ANC: 'terra1747mad58h0w4y589y3sk84r5efqdev9q4r02pc'
}

const ChainNetworks: Partial<ChainNetworkType> = {
  [ChainId.Bitcoin]: {
    [NetworkEnum.Testnet]: BitcoinNetworks.bitcoin_testnet,
    [NetworkEnum.Mainnet]: BitcoinNetworks.bitcoin
  },
  [ChainId.Ethereum]: {
    [NetworkEnum.Testnet]: EthereumNetworks.ropsten,
    [NetworkEnum.Mainnet]: EthereumNetworks.ethereum_mainnet
  },
  [ChainId.Rootstock]: {
    [NetworkEnum.Testnet]: EthereumNetworks.rsk_testnet,
    [NetworkEnum.Mainnet]: EthereumNetworks.rsk_mainnet
  }
}

const chainDefaultColors: Partial<Record<ChainId, string>> = {
  bitcoin: '#EAB300',
  ethereum: '#4F67E4',
  rsk: '#3AB24D',
  bsc: '#F7CA4F',
  near: '#000000',
  polygon: '#8247E5',
  arbitrum: '#28A0EF'
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
  testnet: ['BTC', 'ETH', 'RBTC', 'SOV']
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
  [NetworkEnum.Testnet]: [ChainId.Ethereum, ChainId.Bitcoin, ChainId.Rootstock]
}

const exploraApis: Record<NetworkEnum, string> = {
  [NetworkEnum.Testnet]: 'https://liquality.io/testnet/electrs',
  [NetworkEnum.Mainnet]: 'https://api-mainnet-bitcoin-electrs.liquality.io'
}

const batchEsploraApis: Record<NetworkEnum, string> = {
  [NetworkEnum.Testnet]: 'https://liquality.io/electrs-testnet-batch',
  [NetworkEnum.Mainnet]: 'https://api-mainnet-bitcoin-electrs-batch.liquality.io'
}

const sovereignApis: Record<NetworkEnum, string> = {
  [NetworkEnum.Testnet]: 'https://testnet.sovryn.app/rpc',
  [NetworkEnum.Mainnet]: 'https://mainnet.sovryn.app/rpc'
}

const DefaultNetwork = NetworkEnum.Testnet

const swapProviders: Record<NetworkEnum, Partial<Record<SwapProvidersEnum, SwapProviderType>>> = {
  [NetworkEnum.Testnet]: {
    [SwapProvidersEnum.LIQUALITY]: {
      name: 'Liquality',
      icon: 'liquality.svg',
      type: SwapProvidersEnum.LIQUALITY,
      agent: process.env.AGENT_TESTNET_URL || 'https://liquality.io/swap-testnet-dev/agent'
    },
    [SwapProvidersEnum.SOVRYN]: {
      name: 'Sovyrn',
      icon: 'sovryn.svg',
      type: SwapProvidersEnum.SOVRYN,
      routerAddress: SovrynTestnetAddresses.swapNetwork,
      routerAddressRBTC: SovrynTestnetAddresses.proxy3,
      rpcURL: process.env.SOVRYN_RPC_URL_TESTNET
    }
  },
  [NetworkEnum.Mainnet]: {
    [SwapProvidersEnum.LIQUALITY]: {
      name: 'Liquality',
      icon: 'liquality.svg',
      type: SwapProvidersEnum.LIQUALITY,
      agent: 'https://liquality.io/swap-dev/agent'
    },
    [SwapProvidersEnum.LIQUALITYBOOST]: {
      name: 'Liquality Boost',
      type: SwapProvidersEnum.LIQUALITYBOOST,
      network: 'mainnet',
      icon: 'liqualityboost.svg',
      supportedBridgeAssets: ['MATIC']
    },
    [SwapProvidersEnum.SOVRYN]: {
      name: 'Sovyrn',
      icon: 'sovryn.svg',
      type: SwapProvidersEnum.SOVRYN,
      routerAddress: SovrynMainnetAddresses.swapNetwork,
      routerAddressRBTC: SovrynMainnetAddresses.proxy3,
      rpcURL: process.env.SOVRYN_RPC_URL_MAINNET
    }
  }
}
export class Config implements IConfig {
  private readonly _infuraAPIKey: string

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

  public getDefaultEnabledChains(network: NetworkEnum): ChainId[] {
    return DefaultChains[network]
  }

  public getDefaultEnabledAssets(network: NetworkEnum): string[] {
    return DefaultAssets[network]
  }

  public getPriceFetcherUrl(): string {
    return COIN_GECKO_API
  }

  public getDefaultNetwork(): NetworkEnum {
    return DefaultNetwork
  }

  public getChainColor(chain: ChainId): string {
    return chainDefaultColors[chain]
  }

  public getBitcoinFeeUrl(): string {
    return 'https://liquality.io/swap/mempool/v1/fees/recommended'
  }

  public getTestnetContractAddress(assetSymbol: string): string {
    return TESTNET_CONTRACT_ADDRESSES[assetSymbol]
  }

  public getSovereignRPCAPIUrl(network: NetworkEnum): string {
    return sovereignApis[network]
  }

  public getSwapProvider(network: NetworkEnum, providerId: string): SwapProviderType {
    return swapProviders[network][providerId]
  }

  public getSwapProviders(network: NetworkEnum): Partial<Record<SwapProvidersEnum, SwapProviderType>> {
    return swapProviders[network]
  }

  public getAgentUrl(network: NetworkEnum, provider: SwapProvidersEnum): string {
    return swapProviders[network][provider].agent
  }

  public getInfuraAPIKey(): string {
    return this._infuraAPIKey
  }
}
