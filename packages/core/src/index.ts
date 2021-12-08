import DataMapper from './data-mapper'
import TaskRunner from './task-runner'
import Wallet from './wallet'

import * as feeCalculatorFns from './utils/fee-calculator'
import * as coinFormatterFns from './utils/coin-formatter'
import * as config from './config'
import * as types from './types'

export default {
  utils: {
    ...feeCalculatorFns,
    ...coinFormatterFns
  },
  config,
  types,
  Wallet,
  DataMapper,
  TaskRunner
}
