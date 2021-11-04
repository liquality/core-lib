"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const config_1 = __importStar(require("./config"));
const types_1 = require("./types");
const bip39_1 = require("bip39");
const cryptoassets_1 = require("@liquality/cryptoassets");
const ethereum_gas_now_fee_provider_1 = require("@liquality/ethereum-gas-now-fee-provider");
const ethereum_rpc_fee_provider_1 = require("@liquality/ethereum-rpc-fee-provider");
const axios_1 = __importDefault(require("axios"));
const abstract_wallet_manager_1 = __importDefault(require("./abstract-wallet-manager"));
const ETHEREUM_TESTNET_URL = `https://ropsten.infura.io/v3/${config_1.default.infuraApiKey}`;
const ETHEREUM_MAINNET_URL = `https://mainnet.infura.io/v3/${config_1.default.infuraApiKey}`;
//TODO move urls to a config file
class WalletManager extends abstract_wallet_manager_1.default {
    constructor(storageManager, encryptionManager) {
        super();
        this.wallets = [];
        this.password = '';
        this.cryptoassets = cryptoassets_1.assets;
        this.chains = cryptoassets_1.chains;
        this.storageManager = storageManager;
        this.encryptionManager = encryptionManager;
    }
    /**
     * Creates a wallet along with an account
     */
    createWallet(wallet, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const walletId = (0, uuid_1.v4)();
            this.wallets = [
                Object.assign({ id: walletId, at: Date.now(), name: 'Account-1' }, wallet)
            ];
            this.password = password;
            const accounts = { [walletId]: {} };
            const at = Date.now();
            const { networks, defaultAssets } = config_1.default;
            const { encrypted: encryptedWallets, keySalt } = yield this.encryptionManager.encrypt(JSON.stringify(this.wallets), password);
            networks.forEach((network) => {
                const assetKeys = defaultAssets[network];
                accounts[walletId][network] = [];
                config_1.default.chains.forEach((chainId) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const assetList = assetKeys.filter((asset) => {
                        var _a;
                        return ((_a = this.cryptoassets[asset]) === null || _a === void 0 ? void 0 : _a.chain) === chainId;
                    });
                    const chain = this.chains[chainId];
                    (_a = accounts[walletId][network]) === null || _a === void 0 ? void 0 : _a.push({
                        name: `${chain.name} 1`,
                        chain: chainId,
                        type: 'default',
                        index: 0,
                        addresses: [],
                        assets: assetList,
                        balances: {},
                        color: this.getNextAccountColor(chainId, 0),
                        createdAt: at,
                        updatedAt: at
                    });
                }));
            });
            const state = {
                activeWalletId: walletId,
                encryptedWallets,
                keySalt,
                accounts
            };
            //persist to local storage
            yield this.persistToLocalStorage(state);
            return Object.assign(Object.assign({}, state), { wallets: this.wallets, key: this.password, fees: {
                    [types_1.NetworkEnum.Mainnet]: {
                        [walletId]: {}
                    },
                    [types_1.NetworkEnum.Testnet]: {
                        [walletId]: {}
                    }
                } });
        });
    }
    retrieveWallet() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.storageManager.read();
        });
    }
    /**
     * Decrypts the encrypted wallet
     */
    restoreWallet(password, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const { encryptedWallets, keySalt } = state;
            if (!encryptedWallets || !keySalt) {
                throw new Error('Please import/create your wallet');
            }
            const decryptedWallets = yield this.encryptionManager.decrypt(encryptedWallets, keySalt, password);
            if (!decryptedWallets) {
                throw new Error('Password Invalid');
            }
            const wallets = JSON.parse(decryptedWallets);
            if (!wallets || wallets.length === 0) {
                throw new Error('Password Invalid');
            }
            const activeWalletId = wallets[0].id;
            //TODO update the enabledAsset dynamically
            return Object.assign(Object.assign({}, state), { key: password, unlockedAt: Date.now(), wallets, enabledAssets: {
                    [types_1.NetworkEnum.Mainnet]: {
                        [activeWalletId]: ['ETH']
                    },
                    [types_1.NetworkEnum.Testnet]: {
                        [activeWalletId]: ['ETH']
                    }
                }, fees: {
                    [types_1.NetworkEnum.Mainnet]: {
                        [activeWalletId]: {}
                    },
                    [types_1.NetworkEnum.Testnet]: {
                        [activeWalletId]: {}
                    }
                }, activeNetwork: types_1.NetworkEnum.Testnet });
        });
    }
    sendTransaction(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client) {
                return new Error('client is not instantiated');
            }
            return yield this.client.chain.sendTransaction(options);
        });
    }
    //TODO refactor
    updateAddressesAndBalances(state) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const stateClone = Object.assign({}, state);
            for (const walletId in stateClone.accounts) {
                const network = stateClone.accounts[walletId];
                for (const networkId in network) {
                    if (stateClone.activeNetwork !== networkId) {
                        continue;
                    }
                    const accounts = network[networkId];
                    for (const account of accounts) {
                        for (const asset of account.assets) {
                            if (!stateClone.enabledAssets || !stateClone.enabledAssets[networkId][walletId].includes(asset)) {
                                continue;
                            }
                            const derivationPath = this.calculateDerivationPaths(account.chain)(networkId, account.index);
                            if (!derivationPath) {
                                throw new Error('Unable to generate address. Derivation path missing');
                            }
                            const isTestnet = networkId === types_1.NetworkEnum.Testnet;
                            const ethereumNetwork = config_1.ChainNetworks[cryptoassets_1.ChainId.Ethereum][networkId];
                            const infuraApi = isTestnet ? ETHEREUM_TESTNET_URL : ETHEREUM_MAINNET_URL;
                            const feeProvider = isTestnet ? new ethereum_rpc_fee_provider_1.EthereumRpcFeeProvider() : new ethereum_gas_now_fee_provider_1.EthereumGasNowFeeProvider();
                            const mnemonic = (_b = (_a = stateClone.wallets) === null || _a === void 0 ? void 0 : _a.find((w) => w.id === walletId)) === null || _b === void 0 ? void 0 : _b.mnemomnic;
                            if (!mnemonic) {
                                throw new Error('Unable to generate address. Mnemonic missing');
                            }
                            const client = this.createEthereumClient(ethereumNetwork, infuraApi, feeProvider, mnemonic, derivationPath);
                            const result = yield client.wallet.getUnusedAddress();
                            const balance = (yield client.chain.getBalance([result])).toNumber();
                            const feeDetails = yield client.chain.getFees();
                            stateClone.fees[networkId][walletId][this.cryptoassets[asset].chain] = feeDetails;
                            const address = (0, cryptoassets_1.isEthereumChain)(this.cryptoassets[asset].chain)
                                ? result.address.replace('0x', '')
                                : result.address; // TODO: Should not require removing 0x
                            account.addresses.push(address);
                            account.balances[asset] = balance;
                        }
                    }
                }
            }
            return stateClone;
        });
    }
    getPricesForAssets(baseCurrencies, toCurrency) {
        return __awaiter(this, void 0, void 0, function* () {
            const COIN_GECKO_API = 'https://api.coingecko.com/api/v3';
            const coindIds = baseCurrencies
                .filter((currency) => { var _a; return (_a = this.cryptoassets[currency]) === null || _a === void 0 ? void 0 : _a.coinGeckoId; })
                .map((currency) => this.cryptoassets[currency].coinGeckoId);
            const { data } = yield axios_1.default.get(`${COIN_GECKO_API}/simple/price?ids=${coindIds.join(',')}&vs_currencies=${toCurrency}`);
            let prices = Object.keys(data).reduce((acc, coinGeckoId) => {
                const asset = Object.entries(this.cryptoassets).find((entry) => {
                    return entry[1].coinGeckoId === coinGeckoId;
                });
                if (asset) {
                    acc[asset[0]] = {
                        [toCurrency.toUpperCase()]: data[coinGeckoId][toCurrency.toLowerCase()]
                    };
                }
                return acc;
            }, {});
            for (const baseCurrency of baseCurrencies) {
                if (!prices[baseCurrency] && this.cryptoassets[baseCurrency].matchingAsset) {
                    prices[baseCurrency] = prices[this.cryptoassets[baseCurrency].matchingAsset];
                }
            }
            return Object.keys(prices).reduce((acc, assetName) => {
                acc[assetName] = prices[assetName][toCurrency.toUpperCase()];
                return acc;
            }, {});
        });
    }
    static generateSeedWords() {
        return (0, bip39_1.generateMnemonic)().split(' ');
    }
    static validateSeedPhrase(seedPhrase) {
        return (0, bip39_1.validateMnemonic)(seedPhrase);
    }
}
exports.default = WalletManager;
//# sourceMappingURL=wallet-manager.js.map