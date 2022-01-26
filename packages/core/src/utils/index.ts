import { chains, assets as cryptoassets, isEthereumChain as _isEthereumChain } from '@liquality/cryptoassets'
import { SwapTransactionType } from '../types'

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

export const withInterval = async (func: () => unknown): Promise<Partial<SwapTransactionType>> => {
  const updates = await func()
  if (updates) {
    return updates
  }
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const updates = await func()
        if (updates) {
          clearInterval(interval)
          resolve(updates)
        }
      } catch (e) {
        reject(`Failed to run: ${func.name}`)
      }
    }, 15000 * Math.random() + 15000)
  })
}
