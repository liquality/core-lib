import AbstractWalletManager from './abstract-wallet-manager'
import DataMapper from './data-mapper'
import EncryptionManager from './encryption-manager'
import mkStorageManager from './storage-manager'
import TaskRunner from './task-runner'

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
  mkStorageManager,
  AbstractWalletManager,
  DataMapper,
  EncryptionManager,
  TaskRunner
}
