import * as core from '..'
import LiqualityRuleEngine from '../src/rule-engine/liquality-rule-engine'
import { HistoryItem, NetworkEnum, SwapTransactionType, TriggerType } from '../src/types'
import LiqualitySwapProvider from '../src/swaps/liquality-swap-provider'
import { Config } from '../src/config'
import EthereumAccount from '../src/accounts/ethereum-account'
import { ChainId } from '@liquality/cryptoassets' // import from built files

describe('core', () => {
  it('exports something', () => {
    expect(core).toBeTruthy()
  })

  it('Rules Engine - Refund path', async () => {
    const swap: Partial<SwapTransactionType> = {
      status: 'WAITING_FOR_REFUND'
    }
    const callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>> = {}
    const swapProvider = new LiqualitySwapProvider(new Config(''), NetworkEnum.Testnet, '123', callbacks)
    jest.spyOn(swapProvider, 'waitForRefund').mockImplementation(async () => ({
      refundHash: '123120239303',
      status: 'WAITING_FOR_REFUND_CONFIRMATIONS'
    }))

    jest.spyOn(swapProvider, 'refundSwap').mockImplementation(async () => ({
      refundHash: '1111111111',
      status: 'WAITING_FOR_REFUND_CONFIRMATIONS'
    }))
    jest.spyOn(swapProvider, 'waitForRefundConfirmations').mockImplementation(async () => ({
      endTime: Date.now(),
      status: 'REFUNDED'
    }))
    const engine = new LiqualityRuleEngine(null, null, swapProvider, swap, (historyItem: HistoryItem) =>
      console.log(historyItem)
    )
    await engine.start()
    expect(core).toBeTruthy()
  })

  it('Rules Engine - Swap Path', async () => {
    jest.setTimeout(10000)
    const swap: Partial<SwapTransactionType> = {
      status: 'INITIATED'
    }
    const callbacks: Partial<Record<TriggerType, (...args: unknown[]) => void>> = {}
    const swapProvider = new LiqualitySwapProvider(new Config(''), NetworkEnum.Testnet, '123', callbacks)
    const account = new EthereumAccount(new Config(''), '123', 0, ChainId.Ethereum, NetworkEnum.Testnet, [], null)
    jest.spyOn(swapProvider, 'waitForRefund').mockImplementation(async () => {
      console.log('waitForRefund...')
      return null
    })
    jest.spyOn(swapProvider, 'updateOrder').mockImplementation(async () => {
      console.log('updating order...')
      return {}
    })

    jest.spyOn(swapProvider, 'confirmInitiation').mockImplementation(async () => ({
      refundHash: '1111111111',
      status: 'INITIATION_CONFIRMED'
    }))
    jest.spyOn(swapProvider, 'fundSwap').mockImplementation(async () => ({
      status: 'FUNDED'
    }))
    jest.spyOn(swapProvider, 'findCounterPartyInitiation').mockImplementation(async () => ({
      status: 'CONFIRM_COUNTER_PARTY_INITIATION'
    }))
    jest.spyOn(swapProvider, 'confirmCounterPartyInitiation').mockImplementation(async () => ({
      status: 'READY_TO_CLAIM',
      toFundHash: '123234'
    }))
    jest.spyOn(swapProvider, 'claimSwap').mockImplementation(async () => ({
      status: 'WAITING_FOR_CLAIM_CONFIRMATIONS',
      toClaimHash: '1234',
      toClaimTx: {
        hash: '1234',
        value: 1234,
        _raw: {
          to: 123
        }
      }
    }))
    jest.spyOn(swapProvider, 'waitForClaimConfirmations').mockImplementation(async () => ({
      status: 'SUCCESS'
    }))
    const engine = new LiqualityRuleEngine(account, account, swapProvider, swap, (historyItem: HistoryItem) =>
      console.log(historyItem)
    )
    await engine.start()
    expect(core).toBeTruthy()
  })
})
