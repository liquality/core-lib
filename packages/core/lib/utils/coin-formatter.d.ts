import BigNumber from 'bignumber.js';
export declare const VALUE_DECIMALS = 6;
export declare const dp: (amount: number, coin: string) => BigNumber;
export declare const dpUI: (amount: BigNumber, decimalPlaces?: number) => BigNumber;
export declare const prettyBalance: (amount: BigNumber, coin: string, decimalPlaces?: number) => string;
export declare const prettyFiatBalance: (amount: number, rate: number) => string;
export declare const cryptoToFiat: (amount: number, rate: number) => BigNumber;
export declare const fiatToCrypto: (amount: BigNumber, rate: number) => BigNumber;
export declare const formatFiat: (amount: BigNumber | number) => string;
