import { ArrayElement, EncryptionManagerI, StateType, StorageManagerI, WalletManagerI } from './types';
import { assets } from '@liquality/cryptoassets';
import AbstractWalletManager from './abstract-wallet-manager';
import { SendOptions, Transaction } from '@liquality/types';
declare class WalletManager extends AbstractWalletManager implements WalletManagerI {
    wallets: StateType['wallets'];
    password: string;
    cryptoassets: typeof assets;
    chains: unknown;
    storageManager: StorageManagerI<StateType>;
    encryptionManager: EncryptionManagerI;
    constructor(storageManager: StorageManagerI<StateType>, encryptionManager: EncryptionManagerI);
    /**
     * Creates a wallet along with an account
     */
    createWallet(wallet: Omit<ArrayElement<StateType['wallets']>, 'id' | 'at' | 'name'>, password: string): Promise<StateType>;
    retrieveWallet(): Promise<StateType>;
    /**
     * Decrypts the encrypted wallet
     */
    restoreWallet(password: string, state: StateType): Promise<StateType>;
    sendTransaction(options: SendOptions): Promise<Transaction | Error>;
    updateAddressesAndBalances(state: StateType): Promise<StateType>;
    getPricesForAssets(baseCurrencies: Array<string>, toCurrency: string): Promise<StateType['fiatRates']>;
    static generateSeedWords(): string[];
    static validateSeedPhrase(seedPhrase: string): boolean;
}
export default WalletManager;
