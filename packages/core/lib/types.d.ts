import { ChainId } from '@liquality/cryptoassets/src/types';
import { BitcoinNetwork } from '@liquality/bitcoin-networks';
import { EthereumNetwork } from '@liquality/ethereum-networks';
import { FeeDetails } from '@liquality/types/lib/fees';
import { SendOptions, Transaction } from '@liquality/types';
export interface WalletManagerI {
    createWallet: (wallet: Omit<ArrayElement<StateType['wallets']>, 'id' | 'at' | 'name'>, password: string) => Promise<StateType>;
    retrieveWallet: () => Promise<StateType>;
    restoreWallet: (password: string, state: StateType) => Promise<StateType>;
    sendTransaction: (options: SendOptions) => Promise<Transaction | Error>;
    updateAddressesAndBalances: (state: StateType) => Promise<StateType>;
    getPricesForAssets: (baseCurrencies: Array<string>, toCurrency: string) => Promise<StateType['fiatRates']>;
}
/**
 * Interface that abstracts storage functionality so it can work seamlessly on different platforms
 */
export interface StorageManagerI<T> {
    persist: (data: T) => Promise<boolean | Error>;
    read: () => Promise<T>;
}
export interface EncryptionManagerI {
    generateSalt: (byteCount: number) => string;
    encrypt: (value: string, password: string) => Promise<{
        encrypted: string;
        keySalt: string;
    }>;
    decrypt: (encrypted: string, keySalt: string, password: string) => Promise<string>;
}
export interface DataMapperI<T, R> {
    process: (input: T) => DataMapperI<T, R>;
    toJson: () => R;
}
export declare type GasSpeedType = 'slow' | 'average' | 'fast';
export interface AccountType {
    name: string;
    chain: ChainId;
    type: string;
    index: number;
    addresses: Array<string>;
    assets: Array<string>;
    balances?: Record<string, number>;
    color: string;
    createdAt: number;
    updatedAt?: number;
}
export declare type ChainNetworkType = Record<ChainId, Record<NetworkEnum, BitcoinNetwork | EthereumNetwork>>;
export declare enum NetworkEnum {
    Mainnet = "mainnet",
    Testnet = "testnet"
}
export declare type ArrayElement<A> = A extends readonly (infer T)[] ? T : never;
export interface FlatState {
    assetCount: number;
    totalBalance: number;
    totalBalanceInFiat: number;
}
export interface StateType {
    key?: string;
    wallets?: {
        id: string;
        at: number;
        name: string;
        assets?: Array<string>;
        activeNetwork?: NetworkEnum;
        mnemomnic?: string;
        imported?: boolean;
    }[];
    unlockedAt?: number;
    version?: number;
    brokerReady?: boolean;
    encryptedWallets?: string;
    enabledAssets?: Record<NetworkEnum, {
        [walletId: string]: string[];
    }>;
    customTokens?: any;
    accounts?: Record<string, Partial<Record<NetworkEnum, AccountType[]>>>;
    fiatRates?: Record<string, number>;
    fees?: Partial<Record<NetworkEnum, {
        [walletId: string]: {
            [asset: string]: FeeDetails;
        };
    }>>;
    history?: any;
    marketData?: any;
    activeNetwork?: NetworkEnum;
    activeWalletId?: string;
    activeAsset?: any;
    keyUpdatedAt?: number;
    keySalt?: string;
    termsAcceptedAt?: number;
    setupAt?: number;
    injectEthereum?: boolean;
    injectEthereumChain?: string;
    usbBridgeWindowsId?: number;
    externalConnections?: any;
    analytics?: {
        userId: string;
        acceptedDate: number;
        askedDate: number;
        askedTimes: number;
        notAskAgain: boolean;
    };
    errorMessage?: string;
}
