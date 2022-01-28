import { v4 as uuidv4 } from 'uuid'
import * as ethers from 'ethers'
import { chains, currencyToUnit, unitToCurrency, assets as cryptoassets } from '@liquality/cryptoassets'
import SwapProvider from './swap-provider'
import ERC20 from '@uniswap/v2-core/build/ERC20.json'

import SovrynSwapNetworkABI from '@blobfishkate/sovryncontracts/abi/abiSovrynSwapNetwork.json'
import RBTCWrapperProxyABI from '@blobfishkate/sovryncontracts/abi/abiWrapperProxy_new.json'
import SovrynMainnetAddresses from '@blobfishkate/sovryncontracts/contracts-mainnet.json'
import SovrynTestnetAddresses from '@blobfishkate/sovryncontracts/contracts-testnet.json'
import {
  IAccount,
  IConfig,
  MarketDataType,
  NetworkEnum,
  QuoteType,
  SwapPayloadType,
  SwapProvidersEnum,
  SwapTransactionType,
  TriggerType
} from '../types'
import { isERC20 } from '../utils'
import { BigNumber, SendOptions } from '@liquality/types'
import { Mutex } from 'async-mutex'

// use WRBTC address for RBTC native token
const wrappedRbtcAddress = {
  mainnet: SovrynMainnetAddresses.BTC_token,
  testnet: SovrynTestnetAddresses.BTC_token
}

type SwapTxType = {
  from: string
  to: string
  value: BigNumber
  data: string
  fee: number
}

type ApprovalTxType = SwapTxType

class SovrynSwapProvider extends SwapProvider {
  private _apiCache: any
  private _activeNetwork: NetworkEnum
  private _activeWalletId: string
  private _provider: SwapProvidersEnum
  private _mutex: Mutex
  private readonly _callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>>

  constructor(
    config: IConfig,
    activeNetwork: NetworkEnum,
    activeWalletId: string,
    callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>>
  ) {
    super()
    this._config = config
    this._apiCache = {} // chainId to RPC provider
    this._activeNetwork = activeNetwork
    this._activeWalletId = activeWalletId
    this._provider = SwapProvidersEnum.SOVRYN
    this._callbacks = callbacks
    this._mutex = new Mutex()
  }

  public async getSupportedPairs() {
    return []
  }

  // returns rates between tokens
  public async getQuote(marketData: MarketDataType[], from: string, to: string, amount: BigNumber): Promise<QuoteType> {
    const fromInfo = cryptoassets[from]
    const toInfo = cryptoassets[to]

    // only RSK network swaps
    if (fromInfo.chain !== 'rsk' || toInfo.chain !== 'rsk' || amount.lt(0)) return null

    const fromTokenAddress = (fromInfo.contractAddress || wrappedRbtcAddress[this._activeNetwork]).toLowerCase()
    const toTokenAddress = (toInfo.contractAddress || wrappedRbtcAddress[this._activeNetwork]).toLowerCase()
    const fromAmountInUnit = currencyToUnit(fromInfo, amount.toNumber()).toFixed()

    const ssnContract = new ethers.Contract(
      this._config.getSwapProvider(this._activeNetwork, SwapProvidersEnum.SOVRYN).routerAddress.toLowerCase(),
      SovrynSwapNetworkABI,
      this._getApi(from)
    )

    // generate path
    const path = await ssnContract.conversionPath(fromTokenAddress, toTokenAddress)
    // calculate rates
    const rate = await ssnContract.rateByPath(path, fromAmountInUnit)

    return {
      from,
      to,
      fromAmount: new BigNumber(fromAmountInUnit),
      toAmount: rate.toString(),
      path: path
    }
  }

  public async performSwap(
    fromAccount: IAccount,
    toAccount: IAccount,
    quote: Partial<SwapPayloadType>
  ): Promise<Partial<SwapTransactionType>> {
    const approvalRequired = isERC20(quote.from)
    const updates = approvalRequired
      ? await this.approveTokens(fromAccount, quote)
      : await this.sendSwap(fromAccount, quote)

    return {
      id: uuidv4(),
      fee: quote.fee,
      slippage: 50,
      ...updates
    }
  }

  public runRulesEngine(fromAccount: IAccount, toAccount: IAccount, swapTransaction: Partial<SwapTransactionType>) {
    if (!this._mutex.isLocked()) {
      console.log(fromAccount, toAccount, swapTransaction)
      //Makes sure we can only run one instance of the rule engine at any given time for a given swap provider
      // this._mutex.runExclusive(() => {
      //   new LiqualityRuleEngine(
      //     fromAccount,
      //     toAccount,
      //     this,
      //     swapTransaction,
      //     this._callbacks['onTransactionUpdate']
      //   ).start()
      // })
    } else {
      throw new Error('Rules Engine already running for this provider')
    }
  }

  //  ======== FEES ========
  public async estimateFees(
    fromAccount: IAccount,
    fromAsset: string,
    txType: string,
    quote: QuoteType,
    feePrices: number[]
  ): Promise<Record<number, BigNumber>> {
    if (txType !== this.fromTxType) throw new Error(`Invalid tx type ${txType}`)

    const nativeAsset = chains[cryptoassets[fromAsset].chain].nativeAsset
    const client = ((await fromAccount.getAssets()) || [])
      .filter((asset) => asset.getSymbol() === fromAsset)[0]
      .getClient()
    // const account = this.getAccount(quote.fromAccountId)
    // const client = this.getClient(this, walletId, quote.from, account?.type)

    let gasLimit = 0
    if (await this.requiresApproval(fromAccount, quote)) {
      const approvalTx = await this.buildApprovalTx(fromAccount, quote)
      const rawApprovalTx = {
        from: approvalTx.from,
        to: approvalTx.to,
        data: approvalTx.data,
        value: '0x' + approvalTx.value.toString(16)
      }

      gasLimit += await client.getMethod('estimateGas')(rawApprovalTx)
    }

    // Due to a problem on RSK network with incorrect gas estimations, the gas used by swap transaction
    // is hardcoded to 750k. This value is recommended by Sovryn team! Real gas usage is between 380k and 500k
    // and it depends on the number of steps in the conversion path.
    gasLimit += 750000

    const fees = {}
    for (const feePrice of feePrices) {
      const gasPrice = new BigNumber(feePrice).times(1e9) // ETH fee price is in gwei
      const fee = new BigNumber(gasLimit).times(1.1).times(gasPrice)
      fees[feePrice] = unitToCurrency(cryptoassets[nativeAsset], fee.toNumber()).toFixed()
    }

    return fees
  }

  // ======== APPROVAL ========
  private async requiresApproval(fromAccount: IAccount, quote) {
    if (!isERC20(quote.from)) return false

    const fromInfo = cryptoassets[quote.from]
    const toInfo = cryptoassets[quote.to]
    const erc20 = new ethers.Contract(fromInfo.contractAddress.toLowerCase(), ERC20.abi, this._getApi(quote.from))

    const fromAddressRaw = (await fromAccount.getUsedAddress()).address
    const fromAddress = chains[fromInfo.chain].formatAddress(fromAddressRaw, this._activeNetwork)
    const spender = (
      fromInfo.type === 'native' || toInfo.type === 'native'
        ? this._config.getSwapProvider(this._activeNetwork, fromInfo.chain).routerAddressRBTC
        : this._config.getSwapProvider(this._activeNetwork, fromInfo.chain).routerAddress
    ).toLowerCase()
    const allowance = await erc20.allowance(fromAddress.toLowerCase(), spender)
    const inputAmount = ethers.BigNumber.from(new BigNumber(quote.fromAmount).toFixed())
    return !allowance.gte(inputAmount)
  }

  private async buildApprovalTx(fromAccount: IAccount, quote): Promise<ApprovalTxType> {
    const fromInfo = cryptoassets[quote.from]
    const toInfo = cryptoassets[quote.to]
    const erc20 = new ethers.Contract(fromInfo.contractAddress.toLowerCase(), ERC20.abi, this._getApi(quote.from))

    const inputAmount = ethers.BigNumber.from(new BigNumber(quote.fromAmount).toFixed())
    const inputAmountHex = inputAmount.toHexString()
    // in case native token is involved -> give allowance to wrapper contract
    const spender = (
      fromInfo.type === 'native' || toInfo.type === 'native'
        ? this._config.getSwapProvider(this._activeNetwork, SwapProvidersEnum.SOVRYN).routerAddressRBTC
        : this._config.getSwapProvider(this._activeNetwork, SwapProvidersEnum.SOVRYN).routerAddress
    ).toLowerCase()
    const encodedData = erc20.interface.encodeFunctionData('approve', [spender, inputAmountHex])

    const fromChain = fromInfo.chain
    const fromAddressRaw = (await fromAccount.getUsedAddress()).address
    const fromAddress = chains[fromChain].formatAddress(fromAddressRaw, this._activeNetwork)

    return {
      from: fromAddress, // Required for estimation only (not used in chain client)
      to: fromInfo.contractAddress,
      value: new BigNumber(0),
      data: encodedData,
      fee: quote.fee
    }
  }

  private async approveTokens(fromAccount: IAccount, quote) {
    const requiresApproval = await this.requiresApproval(fromAccount, quote)
    if (!requiresApproval) {
      return {
        status: 'APPROVE_CONFIRMED'
      }
    }

    const txData: SendOptions = await this.buildApprovalTx(fromAccount, quote)
    const client = fromAccount.getClient()
    const approveTx = await client.chain.sendTransaction(txData)

    return {
      status: 'WAITING_FOR_APPROVE_CONFIRMATIONS',
      approveTx,
      approveTxHash: approveTx.hash
    }
  }

  // ======== SWAP ========

  private async buildSwapTx(fromAccount: IAccount, quote): Promise<SwapTxType> {
    const fromInfo = cryptoassets[quote.from]
    const toInfo = cryptoassets[quote.to]

    const api = this._getApi(quote.from)
    const coversionPath = quote.path
    const toAmountWithSlippage = this._calculateSlippage(quote.toAmount).toString()

    let encodedData
    let routerAddress
    if (fromInfo.type === 'native' || toInfo.type === 'native') {
      // use routerAddressRBTC when native token is present in the swap
      routerAddress = this._config.getSwapProvider(this._activeNetwork, fromInfo.chain).routerAddressRBTC.toLowerCase()
      const wpContract = new ethers.Contract(routerAddress, RBTCWrapperProxyABI, api)
      encodedData = wpContract.interface.encodeFunctionData('convertByPath', [
        coversionPath,
        quote.fromAmount,
        toAmountWithSlippage
      ])
    } else {
      routerAddress = this._config.getSwapProvider(this._activeNetwork, fromInfo.chain).routerAddress.toLowerCase()
      const ssnContract = new ethers.Contract(routerAddress, SovrynSwapNetworkABI, api)

      // ignore affiliate and beneficiary
      encodedData = ssnContract.interface.encodeFunctionData('convertByPath', [
        coversionPath,
        quote.fromAmount,
        toAmountWithSlippage,
        '0x0000000000000000000000000000000000000000', // account that will receive the conversion result or 0x0 to send the result to the sender account
        '0x0000000000000000000000000000000000000000', // wallet address to receive the affiliate fee or 0x0 to disable affiliate fee
        0 // affiliate fee in PPM or 0 to disable affiliate fee
      ])
    }

    const value = isERC20(quote.from) ? 0 : new BigNumber(quote.fromAmount)

    const fromAddressRaw = (await fromAccount.getUsedAddress()).address
    const fromAddress = chains[fromInfo.chain].formatAddress(fromAddressRaw, this._activeNetwork)

    return {
      from: fromAddress, // Required for estimation only (not used in chain client)
      to: routerAddress,
      value: new BigNumber(value),
      data: encodedData,
      fee: quote.fee
    }
  }

  private async sendSwap(fromAccount: IAccount, quote) {
    const txData = await this.buildSwapTx(fromAccount, quote)
    const client = fromAccount.getClient()
    const swapTx = await client.chain.sendTransaction(txData)

    return {
      status: 'WAITING_FOR_SWAP_CONFIRMATIONS',
      swapTx,
      swapTxHash: swapTx.hash
    }
  }

  // ======== STATE TRANSITIONS ========

  async waitForApproveConfirmations(fromAccount, swap) {
    const client = fromAccount.getClient()

    try {
      const tx = await client.chain.getTransactionByHash(swap.approveTxHash)
      if (tx && tx.confirmations > 0) {
        return {
          endTime: Date.now(),
          status: 'APPROVE_CONFIRMED'
        }
      }
    } catch (e) {
      if (e.name === 'TxNotFoundError') console.warn(e)
      else throw e
    }
  }

  async waitForSwapConfirmations(fromAccount: IAccount, swap) {
    const client = fromAccount.getClient()

    try {
      const tx = await client.chain.getTransactionByHash(swap.swapTxHash)
      if (tx && tx.confirmations > 0) {
        // Check transaction status - it may fail due to slippage
        const { status } = await client.getMethod('getTransactionReceipt')(swap.swapTxHash)
        //TODO add logic to update balances
        // this.updateBalances({ network, walletId, assets: [swap.from] })
        return {
          endTime: Date.now(),
          status: Number(status) === 1 ? 'SUCCESS' : 'FAILED'
        }
      }
    } catch (e) {
      if (e.name === 'TxNotFoundError') console.warn(e)
      else throw e
    }
  }

  public async performNextSwapAction(network, walletId, swap) {
    let updates
    //TODO Implement a rules engine for this logic
    switch (swap.status) {
      case 'WAITING_FOR_APPROVE_CONFIRMATIONS':
        // updates = await withInterval(async () => this.waitForApproveConfirmations({ swap, network, walletId }))
        break
      case 'APPROVE_CONFIRMED':
        // updates = await withLock(store, { item: swap, network, walletId, asset: swap.from }, async () =>
        //   this.sendSwap({ quote: swap, network, walletId })
        // )
        break
      case 'WAITING_FOR_SWAP_CONFIRMATIONS':
        // updates = await withInterval(async () => this.waitForSwapConfirmations({ swap, network, walletId }))
        break
    }

    return updates
  }

  // ======== HELPER METHODS ========

  private _getApi(asset) {
    const chain = cryptoassets[asset].chain
    const chainId = this._config.getChainNetwork(chain, this._activeNetwork).chainId
    if (chainId in this._apiCache) {
      return this._apiCache[chainId]
    } else {
      const api = new ethers.providers.StaticJsonRpcProvider(
        this._config.getSwapProvider(this._activeNetwork, SwapProvidersEnum.SOVRYN).rpcURL
      )
      this._apiCache[chainId] = api
      return api
    }
  }

  // 0.5 slippage
  private _calculateSlippage(amount): string {
    return new BigNumber(amount).times(new BigNumber(0.995)).toFixed(0)
  }

  // ======== STATIC ========

  static txTypes = {
    SWAP: 'SWAP'
  }

  public get statuses() {
    return {
      WAITING_FOR_APPROVE_CONFIRMATIONS: {
        step: 0,
        label: 'Approving {from}',
        filterStatus: 'PENDING',
        notification(swap) {
          return {
            message: `Approving ${swap.from}`
          }
        }
      },
      APPROVE_CONFIRMED: {
        step: 1,
        label: 'Swapping {from}',
        filterStatus: 'PENDING'
      },
      WAITING_FOR_SWAP_CONFIRMATIONS: {
        step: 1,
        label: 'Swapping {from}',
        filterStatus: 'PENDING',
        notification() {
          return {
            message: 'Engaging Sovryn'
          }
        }
      },
      SUCCESS: {
        step: 2,
        label: 'Completed',
        filterStatus: 'COMPLETED',
        notification(swap) {
          return {
            message: `Swap completed, ${swap.toAmount} ${swap.to} ready to use`
          }
        }
      },
      FAILED: {
        step: 2,
        label: 'Swap Failed',
        filterStatus: 'REFUNDED',
        notification() {
          return {
            message: 'Swap failed'
          }
        }
      }
    }
  }

  public get fromTxType() {
    return SovrynSwapProvider.txTypes.SWAP
  }

  public get toTxType() {
    return null
  }

  public get timelineDiagramSteps() {
    return ['APPROVE', 'SWAP']
  }

  public get totalSteps() {
    return 3
  }
}

export default SovrynSwapProvider
