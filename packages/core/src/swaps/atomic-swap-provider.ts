import { IAccount, SwapTransactionType } from '../types'

interface IAtomicSwapProvider {
  updateOrder(order: Partial<SwapTransactionType>)

  findCounterPartyInitiation(toAccount: IAccount, swap: Partial<SwapTransactionType>)

  confirmInitiation(fromAccount: IAccount, toAccount: IAccount, swap: Partial<SwapTransactionType>)

  confirmCounterPartyInitiation(toAccount: IAccount, swap: Partial<SwapTransactionType>)

  fundSwap(fromAccount: IAccount, swap: Partial<SwapTransactionType>)

  claimSwap(toAccount: IAccount, swap)

  waitForClaimConfirmations(toAccount: IAccount, swap: Partial<SwapTransactionType>)

  hasSwapExpired(fromAccount: IAccount, swap: Partial<SwapTransactionType>): Promise<boolean>

  waitForRefund(fromAccount: IAccount, swap: Partial<SwapTransactionType>): Promise<boolean>

  refundSwap(account: IAccount, swap: SwapTransactionType): Promise<Partial<SwapTransactionType>>

  waitForRefundConfirmations(fromAccount: IAccount, swap: Partial<SwapTransactionType>)
}

export default IAtomicSwapProvider
