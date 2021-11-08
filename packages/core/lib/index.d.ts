import AbstractWalletManager from './abstract-wallet-manager';
import DataMapper from './data-mapper';
import EncryptionManager from './encryption-manager';
import mkStorageManager from './storage-manager';
import TaskRunner from './task-runner';
import * as config from './config';
import * as types from './types';
declare const _default: {
    utils: {
        VALUE_DECIMALS: 6;
        dp: (amount: number, coin: string) => import("bignumber.js").default;
        dpUI: (amount: import("bignumber.js").default, decimalPlaces?: number) => import("bignumber.js").default;
        prettyBalance: (amount: import("bignumber.js").default, coin: string, decimalPlaces?: number) => string;
        prettyFiatBalance: (amount: number, rate: number) => string;
        cryptoToFiat: (amount: number, rate: number) => import("bignumber.js").default;
        fiatToCrypto: (amount: import("bignumber.js").default, rate: number) => import("bignumber.js").default;
        formatFiat: (amount: number | import("bignumber.js").default) => string;
        calculateGasFee: (_asset: string, _feePrice: number) => number;
        calculateAvailableAmnt: (_asset: string, _feePrice: number, _balance: number) => string;
    };
    config: typeof config;
    types: typeof types;
    mkStorageManager: typeof mkStorageManager;
    AbstractWalletManager: typeof AbstractWalletManager;
    DataMapper: typeof DataMapper;
    EncryptionManager: typeof EncryptionManager;
    TaskRunner: typeof TaskRunner;
};
export default _default;
