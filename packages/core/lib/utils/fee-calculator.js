"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAvailableAmnt = exports.calculateGasFee = void 0;
const tslib_1 = require("tslib");
const bignumber_js_1 = (0, tslib_1.__importDefault)(require("bignumber.js"));
const cryptoassets_1 = require("@liquality/cryptoassets");
const coin_formatter_1 = require("./coin-formatter");
const isERC20 = (asset) => {
    var _a;
    return ((_a = cryptoassets_1.assets[asset]) === null || _a === void 0 ? void 0 : _a.type) === 'erc20';
};
/**
 *
 * @param _asset asset name (ETH)
 * @param _feePrice fee price in currency
 */
const calculateGasFee = (_asset, _feePrice) => {
    if (!_asset || !_feePrice || _feePrice <= 0) {
        throw new Error('Invalid arguments');
    }
    if (!cryptoassets_1.assets[_asset]) {
        throw new Error('Invalid asset name');
    }
    const units = {
        BTC: 290,
        ETH: 21000,
        RBTC: 21000,
        BNB: 21000,
        NEAR: 10000000000000,
        SOL: 1000000,
        MATIC: 21000,
        ERC20: 90000,
        ARBETH: 620000
    };
    const chainId = cryptoassets_1.assets[_asset].chain;
    const nativeAsset = cryptoassets_1.chains[chainId].nativeAsset;
    const feePrice = (0, cryptoassets_1.isEthereumChain)(chainId) ? new bignumber_js_1.default(_feePrice).times(1e9) : _feePrice; // ETH fee price is in gwei
    const asset = isERC20(_asset) ? 'ERC20' : _asset;
    const feeUnit = units[asset];
    return (0, cryptoassets_1.unitToCurrency)(cryptoassets_1.assets[nativeAsset], new bignumber_js_1.default(feeUnit).times(feePrice).toNumber()).dp(6).toNumber();
};
exports.calculateGasFee = calculateGasFee;
/**
 *
 * @param _asset asset name. (ETH)
 * @param _feePrice fee price in currency
 * @param _balance balance amount in unit
 */
const calculateAvailableAmnt = (_asset, _feePrice, _balance) => {
    if (!_asset || !_feePrice || _feePrice <= 0) {
        throw new Error('Invalid arguments');
    }
    if (!cryptoassets_1.assets[_asset]) {
        throw new Error('Invalid asset name');
    }
    if (isERC20(_asset)) {
        return (0, coin_formatter_1.prettyBalance)(new bignumber_js_1.default(_balance), _asset);
    }
    else {
        const available = bignumber_js_1.default.max(new bignumber_js_1.default(_balance).minus((0, cryptoassets_1.currencyToUnit)(cryptoassets_1.assets[_asset], _feePrice)), 0);
        return (0, coin_formatter_1.prettyBalance)(available, _asset);
    }
};
exports.calculateAvailableAmnt = calculateAvailableAmnt;
//# sourceMappingURL=fee-calculator.js.map