"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainNetworks = exports.chainDefaultColors = exports.accountColors = void 0;
const types_1 = require("./types");
const cryptoassets_1 = require("@liquality/cryptoassets");
const bitcoin_networks_1 = require("@liquality/bitcoin-networks");
const ethereum_networks_1 = require("@liquality/ethereum-networks");
exports.accountColors = [
    '#000000',
    '#1CE5C3',
    '#007AFF',
    '#4F67E4',
    '#9D4DFA',
    '#D421EB',
    '#FF287D',
    '#FE7F6B',
    '#EAB300',
    '#F7CA4F',
    '#A1E44A',
    '#3AB24D',
    '#8247E5'
];
exports.chainDefaultColors = {
    bitcoin: '#EAB300',
    ethereum: '#4F67E4',
    rsk: '#3AB24D',
    bsc: '#F7CA4F',
    near: '#000000',
    polygon: '#8247E5',
    arbitrum: '#28A0EF'
};
exports.ChainNetworks = {
    [cryptoassets_1.ChainId.Bitcoin]: {
        [types_1.NetworkEnum.Testnet]: bitcoin_networks_1.BitcoinNetworks.bitcoin_testnet,
        [types_1.NetworkEnum.Mainnet]: bitcoin_networks_1.BitcoinNetworks.bitcoin
    },
    [cryptoassets_1.ChainId.Ethereum]: {
        [types_1.NetworkEnum.Testnet]: ethereum_networks_1.EthereumNetworks.ropsten,
        [types_1.NetworkEnum.Mainnet]: ethereum_networks_1.EthereumNetworks.ethereum_mainnet
    }
};
exports.default = {
    defaultAssets: {
        mainnet: [
            'BTC',
            'ETH',
            'DAI',
            'USDC',
            'USDT',
            'WBTC',
            'UNI',
            'RBTC',
            'SOV',
            'BNB',
            'NEAR',
            'MATIC',
            'PWETH',
            'ARBETH'
        ],
        testnet: ['BTC', 'ETH', 'DAI', 'RBTC', 'BNB', 'NEAR', 'SOV', 'MATIC', 'PWETH', 'ARBETH']
    },
    infuraApiKey: 'da99ebc8c0964bb8bb757b6f8cc40f1f',
    exploraApis: {
        testnet: 'https://liquality.io/testnet/electrs',
        mainnet: 'https://api-mainnet-bitcoin-electrs.liquality.io'
    },
    batchEsploraApis: {
        testnet: 'https://liquality.io/electrs-testnet-batch',
        mainnet: 'https://api-mainnet-bitcoin-electrs-batch.liquality.io'
    },
    networks: ['mainnet', 'testnet'],
    chains: ['bitcoin', 'ethereum', 'rsk', 'bsc', 'near', 'polygon', 'arbitrum']
};
//# sourceMappingURL=config.js.map