"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const cryptoassets_1 = require("@liquality/cryptoassets");
/**
 * A class that converts raw state to computed state to abstract the complexity from the UI
 */
class DataMapper {
    constructor(state) {
        this.totalBalance = new bignumber_js_1.default(0);
        this.assetCount = 0;
        this.state = state;
        this.process();
    }
    process() {
        var _a;
        let totalBalance = new bignumber_js_1.default(0);
        let assetCounter = 0;
        const { activeWalletId, activeNetwork, accounts, fiatRates } = this.state;
        const _accounts = (_a = accounts === null || accounts === void 0 ? void 0 : accounts[activeWalletId]) === null || _a === void 0 ? void 0 : _a[activeNetwork];
        for (let account of _accounts) {
            if (Object.keys(account.balances).length === 0) {
                continue;
            }
            const total = Object.keys(account.balances).reduce((acc, asset) => bignumber_js_1.default.sum(acc, (0, cryptoassets_1.unitToCurrency)(cryptoassets_1.assets[asset], account.balances[asset]).times(fiatRates[asset])), new bignumber_js_1.default(0));
            totalBalance = bignumber_js_1.default.sum(totalBalance, total);
            assetCounter += Object.keys(account.balances).reduce((count, asset) => (account.balances[asset] > 0 ? ++count : count), 0);
        }
        this.assetCount = assetCounter;
        this.totalBalance = totalBalance;
        return this;
    }
    toJson() {
        return {
            assetCount: this.assetCount,
            totalBalance: this.totalBalance.toNumber(),
            totalBalanceInFiat: this.totalBalance.toNumber()
        };
    }
}
exports.default = DataMapper;
//# sourceMappingURL=data-mapper.js.map