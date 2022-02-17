import { IAccount, SwapTransactionType } from '../types'

interface IAtomicSwapProvider {
  updateOrder(order: Partial<SwapTransactionType>): Promise<unknown>

  findCounterPartyInitiation(
    fromAccount: IAccount,
    toAccount: IAccount,
    swap: Partial<SwapTransactionType>
  ): Promise<Partial<SwapTransactionType>>

  confirmInitiation(
    fromAccount: IAccount,
    toAccount: IAccount,
    swap: Partial<SwapTransactionType>
  ): Promise<Partial<SwapTransactionType>>

  confirmCounterPartyInitiation(
    fromAccount: IAccount,
    toAccount: IAccount,
    swap: Partial<SwapTransactionType>
  ): Promise<Partial<SwapTransactionType>>

  fundSwap(fromAccount: IAccount, swap: Partial<SwapTransactionType>): Promise<Partial<SwapTransactionType>>

  claimSwap(fromAccount: IAccount, toAccount: IAccount, swap): Promise<Partial<SwapTransactionType>>

  waitForClaimConfirmations(
    fromAccount: IAccount,
    toAccount: IAccount,
    swap: Partial<SwapTransactionType>
  ): Promise<Partial<SwapTransactionType>>

  waitForRefund(fromAccount: IAccount, swap: Partial<SwapTransactionType>): Promise<Partial<SwapTransactionType>>

  refundSwap(account: IAccount, swap: SwapTransactionType): Promise<Partial<SwapTransactionType>>

  waitForRefundConfirmations(
    fromAccount: IAccount,
    swap: Partial<SwapTransactionType>
  ): Promise<Partial<SwapTransactionType>>
}

export default IAtomicSwapProvider
