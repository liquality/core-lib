/**
 *
 * @param _asset asset name (ETH)
 * @param _feePrice fee price in currency
 */
export declare const calculateGasFee: (_asset: string, _feePrice: number) => number;
/**
 *
 * @param _asset asset name. (ETH)
 * @param _feePrice fee price in currency
 * @param _balance balance amount in unit
 */
export declare const calculateAvailableAmnt: (_asset: string, _feePrice: number, _balance: number) => string;
