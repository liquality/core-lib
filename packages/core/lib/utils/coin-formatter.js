"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatFiat = exports.fiatToCrypto = exports.cryptoToFiat = exports.prettyFiatBalance = exports.prettyBalance = exports.dpUI = exports.dp = exports.VALUE_DECIMALS = void 0;
const tslib_1 = require("tslib");
const bignumber_js_1 = (0, tslib_1.__importDefault)(require("bignumber.js"));
const cryptoassets_1 = require("@liquality/cryptoassets");
exports.VALUE_DECIMALS = 6;
//TODO It is not clear how we should format amounts
const dp = (amount, coin) => {
    if (!amount) {
        return new bignumber_js_1.default(amount);
    }
    return new bignumber_js_1.default(amount).dp(cryptoassets_1.assets[coin].decimals);
};
exports.dp = dp;
const dpUI = (amount, decimalPlaces = exports.VALUE_DECIMALS) => {
    if (!amount) {
        return amount;
    }
    return new bignumber_js_1.default(amount).dp(decimalPlaces, bignumber_js_1.default.ROUND_FLOOR);
};
exports.dpUI = dpUI;
const prettyBalance = (amount, coin, decimalPlaces = exports.VALUE_DECIMALS) => {
    if (!amount || !coin) {
        return '--';
    }
    const coinAsset = cryptoassets_1.assets[coin];
    const currency = new bignumber_js_1.default((0, cryptoassets_1.unitToCurrency)(coinAsset, amount.toNumber()));
    return (0, exports.dpUI)(currency, decimalPlaces).toString();
};
exports.prettyBalance = prettyBalance;
const prettyFiatBalance = (amount, rate) => {
    if (!amount || !rate) {
        return `${amount}`;
    }
    const fiatAmount = (0, exports.cryptoToFiat)(amount, rate);
    return (0, exports.formatFiat)(fiatAmount);
};
exports.prettyFiatBalance = prettyFiatBalance;
const cryptoToFiat = (amount, rate) => {
    if (!rate) {
        return new bignumber_js_1.default(amount);
    }
    return new bignumber_js_1.default(amount).times(rate);
};
exports.cryptoToFiat = cryptoToFiat;
const fiatToCrypto = (amount, rate) => {
    if (!rate) {
        return amount;
    }
    return new bignumber_js_1.default(amount).dividedBy(rate).dp(exports.VALUE_DECIMALS, bignumber_js_1.default.ROUND_FLOOR);
};
exports.fiatToCrypto = fiatToCrypto;
const formatFiat = (amount) => {
    if (!bignumber_js_1.default.isBigNumber(amount)) {
        return new bignumber_js_1.default(amount).toFormat(2, bignumber_js_1.default.ROUND_CEIL);
    }
    return amount.toFormat(2, bignumber_js_1.default.ROUND_CEIL);
};
exports.formatFiat = formatFiat;
//# sourceMappingURL=coin-formatter.js.map