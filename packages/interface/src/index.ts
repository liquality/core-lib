type Mnemonic = string
type Address = string
enum Chain {
  BITCOIN,
  ETHEREUM,
  NEAR,
  TERRA,
  SOLANA
}

enum Network {
  MAINNET,
  TESTNET
}

enum Token {
  NATIVE,
  ERC20,
  ERC721
}

enum Hardware {
  LEDGER
}

export default interface IWalletConstructor {
  new (mnemomic: Mnemonic, network: Network): IWallet
}

export interface IWallet {
  _mnemonic: Mnemonic
  _network: Network
  addAccount(chain: Chain, hardware?: Hardware): Account
  getAccounts(chain: Chain): Account[]
}

type Account = {
  _chain: Chain
  _hardware?: Hardware
  name: string
  getAssets(): Promise<Asset[]>
  getUnusedAddress(): Promise<Address>
  getPublicKey(): Promise<string>
  getPrivateKey(): Promise<string>
}

type Asset = {
  type: Token
  symbol: string
  balance: BigAmount
  getPastTransactions(): Promise<Transaction[]>
  send(amount: BigAmount, to: Address): Promise<unknown>
}

type BigAmount = {
  b: bigint
  m: number
}

type Transaction = {
  amount: BigAmount
  from: Address
  to: Address
}
