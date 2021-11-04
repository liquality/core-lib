import { ChainNetworkType, NetworkEnum } from './types';
import { ChainId } from '@liquality/cryptoassets';
export declare const accountColors: string[];
export declare const chainDefaultColors: Partial<Record<ChainId, string>>;
export declare const ChainNetworks: Partial<ChainNetworkType>;
declare const _default: {
    defaultAssets: Record<NetworkEnum, string[]>;
    infuraApiKey: string;
    exploraApis: {
        testnet: string;
        mainnet: string;
    };
    batchEsploraApis: {
        testnet: string;
        mainnet: string;
    };
    networks: NetworkEnum[];
    chains: ChainId[];
};
export default _default;
