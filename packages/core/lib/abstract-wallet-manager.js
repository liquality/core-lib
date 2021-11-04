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
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const config_1 = __importStar(require("./config"));
const types_2 = require("@liquality/types");
const cryptoassets_1 = require("@liquality/cryptoassets");
const client_1 = require("@liquality/client");
const bitcoin_esplora_batch_api_provider_1 = require("@liquality/bitcoin-esplora-batch-api-provider");
const bitcoin_js_wallet_provider_1 = require("@liquality/bitcoin-js-wallet-provider");
const bitcoin_rpc_fee_provider_1 = require("@liquality/bitcoin-rpc-fee-provider");
const bitcoin_fee_api_provider_1 = require("@liquality/bitcoin-fee-api-provider");
const ethereum_rpc_provider_1 = require("@liquality/ethereum-rpc-provider");
const ethereum_js_wallet_provider_1 = require("@liquality/ethereum-js-wallet-provider");
const BITCOIN_FEE_API_URL = 'https://liquality.io/swap/mempool/v1/fees/recommended';
/**
 * A class that contains functionality that could be shared by the different chains.
 * The idea is to use strategy pattern to handle logic related to different chains
 */
class AbstractWalletManager {
    constructor() {
        this.getEthereumBasedDerivationPath = (coinType, index) => `m/44'/${coinType}'/${index}'/0/0`;
    }
    getNextAccountColor(chain, index) {
        const defaultColor = config_1.chainDefaultColors[chain];
        const defaultIndex = config_1.accountColors.findIndex((c) => c === defaultColor);
        if (defaultIndex === -1) {
            return defaultColor;
        }
        const finalIndex = index + defaultIndex;
        if (finalIndex >= config_1.accountColors.length) {
            return config_1.accountColors[defaultIndex];
        }
        return config_1.accountColors[finalIndex];
    }
    // Derivation paths calculation
    getBitcoinDerivationPath(coinType, index) {
        const BTC_ADDRESS_TYPE_TO_PREFIX = {
            legacy: 44,
            'p2sh-segwit': 49,
            bech32: 84
        };
        return `${BTC_ADDRESS_TYPE_TO_PREFIX[types_2.bitcoin.AddressType.BECH32]}'/${coinType}'/${index}'`;
    }
    calculateDerivationPaths(chainId) {
        if (chainId === cryptoassets_1.ChainId.Bitcoin) {
            return (network, index) => {
                const bitcoinNetwork = config_1.ChainNetworks[cryptoassets_1.ChainId.Bitcoin][network];
                return this.getBitcoinDerivationPath(bitcoinNetwork.coinType, index);
            };
        }
        return (network, index) => {
            const ethNetwork = config_1.ChainNetworks[cryptoassets_1.ChainId.Ethereum][network];
            return this.getEthereumBasedDerivationPath(ethNetwork.coinType, index);
        };
    }
    createBtcClient(network, mnemonic, accountType, derivationPath) {
        const isTestnet = network === types_1.NetworkEnum.Testnet;
        const bitcoinNetwork = config_1.ChainNetworks[cryptoassets_1.ChainId.Bitcoin][network];
        const esploraApi = config_1.default.exploraApis[network];
        const batchEsploraApi = config_1.default.batchEsploraApis[network];
        const btcClient = new client_1.Client();
        btcClient.addProvider(new bitcoin_esplora_batch_api_provider_1.BitcoinEsploraBatchApiProvider({
            batchUrl: batchEsploraApi,
            url: esploraApi,
            network: bitcoinNetwork,
            numberOfBlockConfirmation: 2
        }));
        btcClient.addProvider(
        // @ts-expect-error FIXME
        new bitcoin_js_wallet_provider_1.BitcoinJsWalletProvider({
            network: bitcoinNetwork,
            mnemonic,
            baseDerivationPath: derivationPath
        }));
        if (isTestnet) {
            btcClient.addProvider(new bitcoin_rpc_fee_provider_1.BitcoinRpcFeeProvider());
        }
        else {
            btcClient.addProvider(new bitcoin_fee_api_provider_1.BitcoinFeeApiProvider(BITCOIN_FEE_API_URL));
        }
        return btcClient;
    }
    createEthereumClient(ethereumNetwork, rpcApi, feeProvider, mnemonic, derivationPath) {
        const ethClient = new client_1.Client();
        ethClient.addProvider(new ethereum_rpc_provider_1.EthereumRpcProvider({ uri: rpcApi }));
        ethClient.addProvider(new ethereum_js_wallet_provider_1.EthereumJsWalletProvider({
            network: ethereumNetwork,
            mnemonic,
            derivationPath
        }));
        ethClient.addProvider(feeProvider);
        this.client = ethClient;
        return ethClient;
    }
    persistToLocalStorage(state) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            yield ((_a = this.storageManager) === null || _a === void 0 ? void 0 : _a.persist(state));
        });
    }
}
exports.default = AbstractWalletManager;
//# sourceMappingURL=abstract-wallet-manager.js.map