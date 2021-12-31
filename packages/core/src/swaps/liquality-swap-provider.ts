import axios from 'axios'
import { BigNumber, Transaction } from '@liquality/types'
import {
  assets as cryptoassets,
  chains,
  currencyToUnit,
  isEthereumChain,
  unitToCurrency
} from '@liquality/cryptoassets'
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
import { Client } from '@liquality/client'
import { sha256 } from '@liquality/crypto'
import { prettyBalance } from '../utils/coin-formatter'
import SwapProvider from './swap-provider'
import { isERC20 } from '../utils'

//TODO find a different way to get the version
export const VERSION_STRING = '1.9.1'
// export const VERSION_STRING = `Wallet ${pkg.version} (CAL ${pkg.dependencies['@liquality/client']
//   .replace('^', '')
//   .replace('~', '')})`

export default class LiqualitySwapProvider extends SwapProvider {
  private _activewalletId: string
  private _activeNetwork: NetworkEnum
  private _client: Client
  private _provider: SwapProvidersEnum
  private _swapFromAddress: string
  private _swapToAddress: string
  private _callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>>

  /**
   *
   * @param config
   * @param activeNetwork
   * @param activeWalletId
   * @param callbacks
   */
  constructor(
    config: IConfig,
    activeNetwork: NetworkEnum,
    activeWalletId: string,
    callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>>
  ) {
    super()
    this._config = config
    this._activewalletId = activeWalletId
    this._activeNetwork = activeNetwork
    this._provider = SwapProvidersEnum.LIQUALITY
    this._callbacks = callbacks

    //Fetch market data
    this.getSupportedPairs().then((pairs) => {
      this._callbacks['onMarketDataUpdate']?.(pairs)
    })
  }

  public async getSupportedPairs(): Promise<MarketDataType[]> {
    const markets = (
      await axios({
        url: this._config.getAgentUrl(this._activeNetwork, SwapProvidersEnum.LIQUALITY) + '/api/swap/marketinfo',
        method: 'get',
        headers: {
          'x-requested-with': VERSION_STRING,
          'x-liquality-user-agent': VERSION_STRING
        }
      })
    ).data

    const marketData = markets
      .filter((market) => cryptoassets[market.from] && cryptoassets[market.to])
      .map((market) => ({
        from: market.from,
        to: market.to,
        min: new BigNumber(unitToCurrency(cryptoassets[market.from], market.min)).toFixed(),
        max: new BigNumber(unitToCurrency(cryptoassets[market.from], market.max)).toFixed(),
        rate: new BigNumber(market.rate).toFixed(),
        provider: this._provider.toLocaleLowerCase()
      }))

    this._callbacks['onMarketDataUpdate']?.(marketData)
    return marketData
  }

  public getQuote(marketData: MarketDataType[], from: string, to: string, amount: BigNumber): Promise<QuoteType> {
    // Quotes are retrieved using market data because direct quotes take a long time for BTC swaps (agent takes long to generate new address)
    const market = marketData.find(
      (market) =>
        market.provider === this._provider.toLocaleLowerCase() &&
        market.to === to &&
        market.from === from &&
        new BigNumber(amount).gte(new BigNumber(market.min)) &&
        new BigNumber(amount).lte(new BigNumber(market.max))
    )

    if (!market) return null

    const fromAmount = currencyToUnit(cryptoassets[from], amount.toNumber())

    const toAmount = currencyToUnit(
      cryptoassets[to],
      new BigNumber(amount).times(new BigNumber(market.rate)).toNumber()
    )

    //TODO there are two versions of BigNumber conflicting: TOFIX
    return Promise.resolve({
      from,
      to,
      fromAmount: new BigNumber(fromAmount),
      toAmount: new BigNumber(toAmount)
    })
  }

  public async performSwap(
    fromAccount: IAccount,
    toAccount: IAccount,
    fromAsset: string,
    quote: Partial<SwapPayloadType>
  ): Promise<Partial<SwapTransactionType>> {
    // Quote from the user
    const { from, to, fromAmount, toAmount } = quote

    // Quote from the agent
    const lockedQuote = (
      await axios.post(
        this._config.getAgentUrl(this._activeNetwork, this._provider) + '/api/swap/order',
        {
          from,
          to,
          fromAmount
        },
        {
          headers: {
            'x-requested-with': VERSION_STRING,
            'x-liquality-user-agent': VERSION_STRING
          }
        }
      )
    ).data

    //TODO store this hard-coded value in a config file
    if (new BigNumber(lockedQuote.toAmount).lt(toAmount.times(0.995))) {
      throw new Error('The quote slippage is too high (> 0.5%). Try again.')
    }

    //Merge the two quotes
    const mergedQuote: Partial<QuoteType> = {
      ...quote,
      ...lockedQuote,
      fromAddress: (await fromAccount.getUnusedAddress()).address,
      toAddress: (await toAccount.getUnusedAddress()).address
    }

    //Make sure the quote has not expired
    if (Date.now() >= mergedQuote.expireAt) {
      throw new Error('The quote is expired.')
    }

    //Get a new client
    const assets = await fromAccount.getAssets()
    const fromClient =
      assets.length === 0
        ? fromAccount.getClient()
        : assets.filter((asset) => asset.getSymbol() === fromAsset)[0].getClient()

    if (!fromClient) {
      throw new Error('No compatible client found.')
    }
    // const quote: Partial<SwapPayloadType> = {
    //   type: 'SWAP',
    //   network: this._activeNetwork,
    //   startTime: Date.now(),
    //   walletId: this._activeWalletId,
    //   fee: swapPayload.fee,
    //   claimFee: swapPayload.claimFee
    // }

    const message = [
      'Creating a swap with following terms:',
      `Send: ${mergedQuote.fromAmount} (lowest denomination) ${mergedQuote.from}`,
      `Receive: ${mergedQuote.toAmount} (lowest denomination) ${mergedQuote.to}`,
      `My ${mergedQuote.from} Address: ${mergedQuote.fromAddress}`,
      `My ${mergedQuote.to} Address: ${mergedQuote.toAddress}`,
      `Counterparty ${mergedQuote.from} Address: ${mergedQuote.fromCounterPartyAddress}`,
      `Counterparty ${mergedQuote.to} Address: ${mergedQuote.toCounterPartyAddress}`,
      `Timestamp: ${mergedQuote.swapExpiration}`
    ].join('\n')

    const messageHex = Buffer.from(message, 'utf8').toString('hex')
    const secret = await fromClient.swap.generateSecret(messageHex)
    const secretHash = sha256(secret)

    const fromFundTx: Transaction = await fromClient.swap.initiateSwap(
      {
        value: new BigNumber(mergedQuote.fromAmount),
        recipientAddress: mergedQuote.fromCounterPartyAddress,
        refundAddress: mergedQuote.fromAddress,
        secretHash: secretHash,
        expiration: mergedQuote.swapExpiration
      },
      mergedQuote.fee
    )

    return {
      ...mergedQuote,
      status: 'INITIATED',
      secret,
      secretHash,
      fromFundHash: fromFundTx.hash,
      fromFundTx
    }
  }

  public async estimateFees(
    fromAccount: IAccount,
    fromAsset: string,
    txType: string,
    quote: QuoteType,
    feePrices: number[],
    max: number
  ): Promise<Record<number, BigNumber>> {
    if (txType === LiqualitySwapProvider.txTypes.SWAP_INITIATION && fromAsset === 'BTC') {
      const value = max ? undefined : new BigNumber(quote.fromAmount)
      const txs = feePrices.map((fee) => ({ to: '', value, fee }))
      const totalFees = await this._client.getMethod('getTotalFees')(txs, max)
      const initialValue: Record<number, BigNumber> = {}

      return Object.values<number[]>(totalFees).reduce((acc: Record<number, BigNumber>, [, value]) => {
        acc[value] = new BigNumber(unitToCurrency(cryptoassets[fromAsset], value))
        return acc
      }, initialValue)
    }

    if (txType === LiqualitySwapProvider.txTypes.SWAP_INITIATION && fromAsset === 'UST') {
      const value = max ? undefined : new BigNumber(quote.fromAmount)
      const taxFees = await this._client.getMethod('getTaxFees')(value, 'uusd', max || !value)

      const fees: Record<number, BigNumber> = {}

      for (const feePrice of feePrices) {
        fees[feePrice] = this.getTxFee(LiqualitySwapProvider.feeUnits[txType], fromAsset, feePrice).plus(taxFees)
      }

      return fees
    }

    if (txType in LiqualitySwapProvider.feeUnits) {
      const fees = {}
      for (const feePrice of feePrices) {
        fees[feePrice] = this.getTxFee(LiqualitySwapProvider.feeUnits[txType], fromAsset, feePrice)
      }
      return fees
    }
  }

  performNextSwapAction(network: NetworkEnum, walletId: string, swap: any) {
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

  //Helper methods
  private getTxFee(units, _asset, _feePrice): BigNumber {
    const chainId = cryptoassets[_asset].chain
    const nativeAsset = chains[chainId].nativeAsset
    const feePrice = isEthereumChain(_asset) ? new BigNumber(_feePrice).times(1e9) : _feePrice // ETH fee price is in gwei
    const asset = isERC20(_asset) ? 'ERC20' : _asset
    const feeUnits = units[asset]
    return new BigNumber(unitToCurrency(cryptoassets[nativeAsset], new BigNumber(feeUnits).times(feePrice).toNumber()))
  }

  static txTypes = {
    SWAP_INITIATION: 'SWAP_INITIATION',
    SWAP_CLAIM: 'SWAP_CLAIM'
  }

  static feeUnits = {
    SWAP_INITIATION: {
      ETH: 165000,
      RBTC: 165000,
      BNB: 165000,
      NEAR: 10000000000000,
      SOL: 2,
      LUNA: 650000,
      UST: 650000,
      MATIC: 165000,
      ERC20: 600000 + 94500, // Contract creation + erc20 transfer
      ARBETH: 2400000
    },
    SWAP_CLAIM: {
      BTC: 143,
      ETH: 45000,
      RBTC: 45000,
      BNB: 45000,
      MATIC: 45000,
      NEAR: 8000000000000,
      SOL: 1,
      LUNA: 440000,
      UST: 440000,
      ERC20: 100000,
      ARBETH: 680000
    }
  }

  public get statuses() {
    return {
      INITIATED: {
        step: 0,
        label: 'Locking {from}',
        filterStatus: 'PENDING'
      },
      INITIATION_REPORTED: {
        step: 0,
        label: 'Locking {from}',
        filterStatus: 'PENDING',
        notification() {
          return {
            message: 'Swap initiated'
          }
        }
      },
      INITIATION_CONFIRMED: {
        step: 0,
        label: 'Locking {from}',
        filterStatus: 'PENDING'
      },
      FUNDED: {
        step: 1,
        label: 'Locking {to}',
        filterStatus: 'PENDING'
      },
      CONFIRM_COUNTER_PARTY_INITIATION: {
        step: 1,
        label: 'Locking {to}',
        filterStatus: 'PENDING',
        notification(swap) {
          return {
            message: `Counterparty sent ${prettyBalance(swap.toAmount, swap.to)} ${swap.to} to escrow`
          }
        }
      },
      READY_TO_CLAIM: {
        step: 2,
        label: 'Claiming {to}',
        filterStatus: 'PENDING',
        notification() {
          return {
            message: 'Claiming funds'
          }
        }
      },
      WAITING_FOR_CLAIM_CONFIRMATIONS: {
        step: 2,
        label: 'Claiming {to}',
        filterStatus: 'PENDING'
      },
      WAITING_FOR_REFUND: {
        step: 2,
        label: 'Pending Refund',
        filterStatus: 'PENDING'
      },
      GET_REFUND: {
        step: 2,
        label: 'Refunding {from}',
        filterStatus: 'PENDING'
      },
      WAITING_FOR_REFUND_CONFIRMATIONS: {
        step: 2,
        label: 'Refunding {from}',
        filterStatus: 'PENDING'
      },
      REFUNDED: {
        step: 3,
        label: 'Refunded',
        filterStatus: 'REFUNDED',
        notification(swap) {
          return {
            message: `Swap refunded, ${prettyBalance(swap.fromAmount, swap.from)} ${swap.from} returned`
          }
        }
      },
      SUCCESS: {
        step: 3,
        label: 'Completed',
        filterStatus: 'COMPLETED',
        notification(swap) {
          return {
            message: `Swap completed, ${prettyBalance(swap.toAmount, swap.to)} ${swap.to} ready to use`
          }
        }
      },
      QUOTE_EXPIRED: {
        step: 3,
        label: 'Quote Expired',
        filterStatus: 'REFUNDED'
      }
    }
  }
}
