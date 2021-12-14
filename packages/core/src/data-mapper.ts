import { IDataMapper, FlatState, StateType } from './types'
import BigNumber from 'bignumber.js'
import { assets as cryptoassets, unitToCurrency } from '@liquality/cryptoassets'

/**
 * A class that converts raw state to computed state to abstract the complexity from the UI
 */
// TODO use this class for object transformations
export default class DataMapper implements IDataMapper<StateType, FlatState> {
  state: StateType
  totalBalance: BigNumber = new BigNumber(0)
  assetCount = 0

  constructor(state: StateType) {
    this.state = state
  }

  public marshall(): FlatState {
    let totalBalance = new BigNumber(0)
    let assetCounter = 0
    const { activeWalletId, activeNetwork, accounts, fiatRates } = this.state
    const _accounts = accounts?.[activeWalletId!]?.[activeNetwork!]

    for (const account of _accounts!) {
      if (Object.keys(account.balances!).length === 0) {
        continue
      }

      const total = Object.keys(account.balances!).reduce(
        (acc: BigNumber, asset: string) =>
          BigNumber.sum(acc, unitToCurrency(cryptoassets[asset], account.balances![asset]).times(fiatRates![asset])),
        new BigNumber(0)
      )

      totalBalance = BigNumber.sum(totalBalance, total)

      assetCounter += Object.keys(account.balances!).reduce(
        (count: number, asset: string) => (account.balances![asset] > 0 ? ++count : count),
        0
      )
    }

    this.assetCount = assetCounter
    this.totalBalance = totalBalance

    return {
      assetCount: assetCounter,
      totalBalance: totalBalance,
      totalBalanceInFiat: totalBalance
    }
  }

  public toJson(): FlatState {
    return {
      assetCount: this.assetCount,
      totalBalance: this.totalBalance,
      totalBalanceInFiat: this.totalBalance
    }
  }
}
