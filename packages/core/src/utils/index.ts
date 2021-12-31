import { chains, assets as cryptoassets, isEthereumChain as _isEthereumChain } from '@liquality/cryptoassets'

export const isERC20 = (asset) => {
  return cryptoassets[asset]?.type === 'erc20'
}

export const isEthereumChain = (asset) => {
  const chain = cryptoassets[asset]?.chain
  return _isEthereumChain(chain)
}

export const isEthereumNativeAsset = (asset) => {
  const chainId = cryptoassets[asset]?.chain
  return chainId && _isEthereumChain(chainId) && chains[chainId].nativeAsset === asset
}

export const getNativeAsset = (asset) => {
  const chainId = cryptoassets[asset]?.chain
  return chainId ? chains[chainId].nativeAsset : asset
}
