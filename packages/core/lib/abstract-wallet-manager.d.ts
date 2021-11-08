import { NetworkEnum, StateType, StorageManagerI } from './types';
import { ChainId } from '@liquality/cryptoassets';
import { Client } from '@liquality/client';
import { EthereumNetwork } from '@liquality/ethereum-networks';
import { EthereumRpcFeeProvider } from '@liquality/ethereum-rpc-fee-provider';
import { EthereumGasNowFeeProvider } from '@liquality/ethereum-gas-now-fee-provider';
/**
 * A class that contains functionality that could be shared by the different chains.
 * The idea is to use strategy pattern to handle logic related to different chains
 */
export default class AbstractWalletManager {
    cryptoassets: unknown;
    storageManager: StorageManagerI<StateType> | undefined;
    client: Client | undefined;
    protected getNextAccountColor(chain: ChainId, index: number): string;
    protected getBitcoinDerivationPath(coinType: string, index: number): string;
    protected getEthereumBasedDerivationPath: (coinType: string, index: number) => string;
    protected calculateDerivationPaths(chainId: ChainId): (network: NetworkEnum, index: number) => string | undefined;
    protected createBtcClient(network: NetworkEnum, mnemonic: string, accountType: string, derivationPath: string): Client;
    protected createEthereumClient(ethereumNetwork: EthereumNetwork, rpcApi: string, feeProvider: EthereumRpcFeeProvider | EthereumGasNowFeeProvider, mnemonic: string, derivationPath: string): Client;
    protected persistToLocalStorage(state: StateType): Promise<void>;
}
