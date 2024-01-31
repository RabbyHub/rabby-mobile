import createPersistStore, {
  StorageAdapaterOptions,
} from '@rabby-wallet/persist-store';
import {
  ExplainTxResponse,
  Tx,
  TxPushType,
  TxRequest,
} from '@rabby-wallet/rabby-api/dist/types';
import { produce } from 'immer';
import { nanoid } from 'nanoid';
import { Object as ObjectType } from 'ts-toolbelt';
import { findMaxGasTx } from '../utils/tx';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { sortBy, minBy, maxBy } from 'lodash';
import { openapi, testOpenapi } from '../request';
import { CHAINS } from '@debank/common';
import { EVENTS, eventBus } from '@/utils/events';
import {
  ActionRequireData,
  ParsedActionData,
} from '@/components/Approval/components/Actions/utils';
import { DappInfo } from './dappService';

export interface TransactionHistoryItem {
  address: string;
  chainId: number;
  nonce: number;

  rawTx: Tx;
  createdAt: number;
  hash?: string;
  gasUsed?: number;
  // site?: ConnectedSite;
  site?: DappInfo;

  pushType?: TxPushType;
  reqId?: string;

  isPending?: boolean;
  isWithdrawed?: boolean;
  isFailed?: boolean;
  isSubmitFailed?: boolean;

  explain?: ObjectType.Merge<
    ExplainTxResponse,
    { approvalId: string; calcSuccess: boolean }
  >;
  action?: {
    actionData: ParsedActionData;
    requiredData: ActionRequireData;
  };
}

export interface TransactionSigningItem {
  rawTx: Tx;
  explain?: ObjectType.Merge<
    ExplainTxResponse,
    { approvalId: string; calcSuccess: boolean }
  >;
  action?: {
    actionData: any;
    requiredData: any;
    // actionData: ParsedActionData;
    // requiredData: ActionRequireData;
  };
  id: string;
  isSubmitted?: boolean;
}

interface TxHistoryStore {
  transactions: TransactionHistoryItem[];
}

// TODO
export class TransactionHistoryService {
  /**
   * @description notice, always set store.transactions by calling `_setStoreTransaction`
   */
  store!: TxHistoryStore;

  private _signingTxList: TransactionSigningItem[] = [];

  setStore = (
    recipe: (
      draft: TransactionHistoryItem[],
    ) => TransactionHistoryItem[] | void,
  ) => {
    this.store.transactions = produce(this.store.transactions, recipe);
  };

  getPendingTxsByNonce(address: string, chainId: number, nonce: number) {
    return this.getTransactionGroups({
      address,
      chainId,
      nonce,
    });
  }

  getTransactionGroups({
    address,
    chainId,
    nonce,
  }: {
    address: string;
    chainId?: number;
    nonce?: number;
  }) {
    console.log(JSON.stringify(this.store));
    const groups: TransactionGroup[] = [];

    const store = {
      transactions: [
        {
          address: '0x341a1fbd51825e5a107db54ccb3166deba145479',
          nonce: 115,
          chainId: 1,
          reqId: 'de9baec0b2ea4cfe9dc76c2fe7230348',
          rawTx: {
            from: '0x341a1fbd51825e5a107db54ccb3166deba145479',
            to: '0xf89e7B1D6d5462FdCb9c3E68954AF80D13676E46',
            value: '0x0',
            gasLimit: '0x5028',
            maxFeePerGas: '0x2540be400',
            maxPriorityFeePerGas: '0x3b9aca00',
            chainId: 1,
            gas: '0x7b0c',
            nonce: '0x73',
            data: '0x',
            gasPrice: '0x5d21dba00',
            r: '0x',
            s: '0x',
            v: '0x',
          },
          createdAt: 1706607023053,
          hash: '0x6c1cb74d8fb77602fcfe790259fd2f4402f8f8c6d58185f884c5655a78384a50',
          isPending: true,
          pushType: 'default',
          explain: {
            abi: null,
            abi_str: null,
            balance_change: {
              success: true,
              error: null,
              send_token_list: [],
              receive_token_list: [],
              send_nft_list: [],
              receive_nft_list: [],
              usd_value_change: 0,
            },
            gas: {
              success: true,
              error: null,
              gas_used: 21000,
              gas_limit: 21000,
            },
            is_gnosis: false,
            native_token: {
              id: 'eth',
              chain: 'eth',
              name: 'ETH',
              symbol: 'ETH',
              display_symbol: null,
              optimized_symbol: 'ETH',
              decimals: 18,
              logo_url:
                'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
              protocol_id: '',
              price: 2306.82,
              price_24h_change: 0.017996151877283807,
              credit_score: 100000000,
              is_verified: true,
              is_scam: false,
              is_suspicious: false,
              is_core: true,
              is_wallet: true,
              time_at: 1483200000,
              amount: 0.2751738063706059,
            },
            pre_exec_version: 'v2',
            pre_exec: { success: true, error: null },
            type_send: {
              to_addr: '0xf89e7b1d6d5462fdcb9c3e68954af80d13676e46',
              token_symbol: 'ETH',
              token_amount: 0,
              token: {
                id: 'eth',
                chain: 'eth',
                name: 'ETH',
                symbol: 'ETH',
                display_symbol: null,
                optimized_symbol: 'ETH',
                decimals: 18,
                logo_url:
                  'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
                protocol_id: '',
                price: 2306.82,
                price_24h_change: 0.017996151877283807,
                credit_score: 100000000,
                is_verified: true,
                is_scam: false,
                is_suspicious: false,
                is_core: true,
                is_wallet: true,
                time_at: 1483200000,
                raw_amount: 0,
                raw_amount_hex_str: '0x0',
              },
            },
            trace_id: '7cb9aaf38d424c6f99b6761c706d7f2c',
            approvalId: '177b7962-de18-4acb-978b-efc60f57a0b7',
            calcSuccess: true,
          },
          action: {
            actionData: {
              send: {
                to: '0xf89e7b1d6d5462fdcb9c3e68954af80d13676e46',
                token: {
                  id: 'eth',
                  chain: 'eth',
                  name: 'ETH',
                  symbol: 'ETH',
                  display_symbol: null,
                  optimized_symbol: 'ETH',
                  decimals: 18,
                  logo_url:
                    'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
                  protocol_id: '',
                  price: 2306.82,
                  price_24h_change: 0.017996151877283807,
                  credit_score: 100000000,
                  is_verified: true,
                  is_scam: false,
                  is_suspicious: false,
                  is_core: true,
                  is_wallet: true,
                  time_at: 1483200000,
                  amount: 0,
                  raw_amount: '0',
                },
              },
            },
            requiredData: {
              eoa: null,
              cex: {
                id: 'binance',
                logo: 'https://static.debank.com/image/cex/logo_url/binance/cfa71c75835c750c186010fb19707859.png',
                name: 'Binance',
                bornAt: 1690187848,
                isDeposit: true,
                supportToken: true,
              },
              contract: null,
              usd_value: 31.852407550655588,
              protocol: null,
              hasTransfer: false,
              usedChains: [
                {
                  born_at: 1690187848,
                  id: 'arb',
                  community_id: 42161,
                  name: 'Arbitrum',
                  native_token_id: 'arb',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/arb/854f629937ce94bebeb2cd38fb336de7.png',
                  wrapped_token_id:
                    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
                  is_support_history: true,
                },
                {
                  born_at: 1690189289,
                  id: 'btt',
                  community_id: 199,
                  name: 'BitTorrent',
                  native_token_id: 'btt',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/btt/2130a8d57ff2a0f3d50a4ec9432897c6.png',
                  wrapped_token_id:
                    '0x197a4ed2b1bb607e47a144b9731d7d34f86e9686',
                  is_support_history: false,
                },
                {
                  born_at: 1694267483,
                  id: 'eth',
                  community_id: 1,
                  name: 'Ethereum',
                  native_token_id: 'eth',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png',
                  wrapped_token_id:
                    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                  is_support_history: true,
                },
                {
                  born_at: 1690189286,
                  id: 'celo',
                  community_id: 42220,
                  name: 'Celo',
                  native_token_id: 'celo',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/celo/41da5c1d3c0945ae822a1f85f02c76cf.png',
                  wrapped_token_id:
                    '0x471ece3750da237f93b8e339c536989b8978a438',
                  is_support_history: false,
                },
                {
                  born_at: 1690189295,
                  id: 'xdai',
                  community_id: 100,
                  name: 'Gnosis Chain',
                  native_token_id: 'xdai',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/xdai/43c1e09e93e68c9f0f3b132976394529.png',
                  wrapped_token_id:
                    '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
                  is_support_history: true,
                },
                {
                  born_at: 1694267523,
                  id: 'matic',
                  community_id: 137,
                  name: 'Polygon',
                  native_token_id: 'matic',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/matic/52ca152c08831e4765506c9bd75767e8.png',
                  wrapped_token_id:
                    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                  is_support_history: true,
                },
              ],
              isTokenContract: false,
              name: null,
              onTransferWhitelist: false,
              whitelistEnable: true,
            },
          },
          site: {
            info: {
              description: 'test rabby',
              id: 'https://tester.rabby.io',
              logo_url:
                'https://static.debank.com/image/project/logo_url/galxe/90baa6ae2cb97b4791f02fe66abec4b2.png',
              name: 'Rabby Tester',
              tags: [],
              user_range: 'User >10k',
            },
            chainId: 'ETH',
            origin: 'https://tester.rabby.io',
            isConnected: true,
            isSigned: true,
          },
        },
        {
          address: '0x341a1fbd51825e5a107db54ccb3166deba145479',
          nonce: 114,
          chainId: 1,
          isPending: true,
          rawTx: {
            from: '0x341a1fbd51825e5a107db54ccb3166deba145479',
            to: '0xf89e7B1D6d5462FdCb9c3E68954AF80D13676E46',
            value: '0x0',
            gasLimit: '0x5028',
            maxFeePerGas: '0x2540be600',
            maxPriorityFeePerGas: '0x3b9acb00',
            chainId: 1,
            gas: '0x7b0c',
            nonce: '0x72',
            data: '0x',
            gasPrice: '0x5d21dba00',
            r: '0x',
            s: '0x',
            v: '0x',
          },
          createdAt: 1706603268953,
          hash: '0xd2a8e98da179418fea8336f3997734a180bd93f39f525154bb875686a9009218',
          pushType: 'default',
          explain: {
            abi: null,
            abi_str: null,
            balance_change: {
              success: true,
              error: null,
              send_token_list: [],
              receive_token_list: [],
              send_nft_list: [],
              receive_nft_list: [],
              usd_value_change: 0,
            },
            gas: {
              success: true,
              error: null,
              gas_used: 21000,
              gas_limit: 21000,
            },
            is_gnosis: false,
            native_token: {
              id: 'eth',
              chain: 'eth',
              name: 'ETH',
              symbol: 'ETH',
              display_symbol: null,
              optimized_symbol: 'ETH',
              decimals: 18,
              logo_url:
                'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
              protocol_id: '',
              price: 2311.08,
              price_24h_change: 0.023788639927703716,
              credit_score: 100000000,
              is_verified: true,
              is_scam: false,
              is_suspicious: false,
              is_core: true,
              is_wallet: true,
              time_at: 1483200000,
              amount: 0.2756765516668899,
            },
            pre_exec_version: 'v2',
            pre_exec: { success: true, error: null },
            type_send: {
              to_addr: '0xf89e7b1d6d5462fdcb9c3e68954af80d13676e46',
              token_symbol: 'ETH',
              token_amount: 0,
              token: {
                id: 'eth',
                chain: 'eth',
                name: 'ETH',
                symbol: 'ETH',
                display_symbol: null,
                optimized_symbol: 'ETH',
                decimals: 18,
                logo_url:
                  'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
                protocol_id: '',
                price: 2311.08,
                price_24h_change: 0.023788639927703716,
                credit_score: 100000000,
                is_verified: true,
                is_scam: false,
                is_suspicious: false,
                is_core: true,
                is_wallet: true,
                time_at: 1483200000,
                raw_amount: 0,
                raw_amount_hex_str: '0x0',
              },
            },
            trace_id: '72212df9ac2f417c8877fe99ffbb71d1',
            approvalId: 'e068591e-e04b-49a3-9f38-e4664f44bf2b',
            calcSuccess: true,
          },
          action: {
            actionData: {
              send: {
                to: '0xf89e7b1d6d5462fdcb9c3e68954af80d13676e46',
                token: {
                  id: 'eth',
                  chain: 'eth',
                  name: 'ETH',
                  symbol: 'ETH',
                  display_symbol: null,
                  optimized_symbol: 'ETH',
                  decimals: 18,
                  logo_url:
                    'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
                  protocol_id: '',
                  price: 2311.08,
                  price_24h_change: 0.023788639927703716,
                  credit_score: 100000000,
                  is_verified: true,
                  is_scam: false,
                  is_suspicious: false,
                  is_core: true,
                  is_wallet: true,
                  time_at: 1483200000,
                  amount: 0,
                  raw_amount: '0',
                },
              },
            },
            requiredData: {
              eoa: null,
              cex: {
                id: 'binance',
                logo: 'https://static.debank.com/image/cex/logo_url/binance/cfa71c75835c750c186010fb19707859.png',
                name: 'Binance',
                bornAt: 1690187848,
                isDeposit: true,
                supportToken: true,
              },
              contract: null,
              usd_value: 31.852407550655588,
              protocol: null,
              hasTransfer: false,
              usedChains: [
                {
                  born_at: 1690187848,
                  id: 'arb',
                  community_id: 42161,
                  name: 'Arbitrum',
                  native_token_id: 'arb',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/arb/854f629937ce94bebeb2cd38fb336de7.png',
                  wrapped_token_id:
                    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
                  is_support_history: true,
                },
                {
                  born_at: 1690189289,
                  id: 'btt',
                  community_id: 199,
                  name: 'BitTorrent',
                  native_token_id: 'btt',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/btt/2130a8d57ff2a0f3d50a4ec9432897c6.png',
                  wrapped_token_id:
                    '0x197a4ed2b1bb607e47a144b9731d7d34f86e9686',
                  is_support_history: false,
                },
                {
                  born_at: 1694267483,
                  id: 'eth',
                  community_id: 1,
                  name: 'Ethereum',
                  native_token_id: 'eth',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png',
                  wrapped_token_id:
                    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                  is_support_history: true,
                },
                {
                  born_at: 1690189286,
                  id: 'celo',
                  community_id: 42220,
                  name: 'Celo',
                  native_token_id: 'celo',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/celo/41da5c1d3c0945ae822a1f85f02c76cf.png',
                  wrapped_token_id:
                    '0x471ece3750da237f93b8e339c536989b8978a438',
                  is_support_history: false,
                },
                {
                  born_at: 1690189295,
                  id: 'xdai',
                  community_id: 100,
                  name: 'Gnosis Chain',
                  native_token_id: 'xdai',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/xdai/43c1e09e93e68c9f0f3b132976394529.png',
                  wrapped_token_id:
                    '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
                  is_support_history: true,
                },
                {
                  born_at: 1694267523,
                  id: 'matic',
                  community_id: 137,
                  name: 'Polygon',
                  native_token_id: 'matic',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/matic/52ca152c08831e4765506c9bd75767e8.png',
                  wrapped_token_id:
                    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                  is_support_history: true,
                },
              ],
              isTokenContract: false,
              name: null,
              onTransferWhitelist: false,
              whitelistEnable: true,
            },
          },
        },
        {
          address: '0x341a1fbd51825e5a107db54ccb3166deba145479',
          nonce: 114,
          chainId: 1,
          isPending: true,
          rawTx: {
            from: '0x341a1fbd51825e5a107db54ccb3166deba145479',
            to: '0xf89e7B1D6d5462FdCb9c3E68954AF80D13676E46',
            value: '0x0',
            gasLimit: '0x5028',
            maxFeePerGas: '0x2540be400',
            maxPriorityFeePerGas: '0x3b9aca00',
            chainId: 1,
            gas: '0x7b0c',
            nonce: '0x72',
            data: '0x',
            gasPrice: '0x5d21dba00',
            r: '0x',
            s: '0x',
            v: '0x',
          },
          createdAt: 1706603267953,
          hash: '0xd2a8e98da179418fea8336f3997734a180bd93f39f525154bb875686a9009218',
          pushType: 'default',
          explain: {
            abi: null,
            abi_str: null,
            balance_change: {
              success: true,
              error: null,
              send_token_list: [],
              receive_token_list: [],
              send_nft_list: [],
              receive_nft_list: [],
              usd_value_change: 0,
            },
            gas: {
              success: true,
              error: null,
              gas_used: 21000,
              gas_limit: 21000,
            },
            is_gnosis: false,
            native_token: {
              id: 'eth',
              chain: 'eth',
              name: 'ETH',
              symbol: 'ETH',
              display_symbol: null,
              optimized_symbol: 'ETH',
              decimals: 18,
              logo_url:
                'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
              protocol_id: '',
              price: 2311.08,
              price_24h_change: 0.023788639927703716,
              credit_score: 100000000,
              is_verified: true,
              is_scam: false,
              is_suspicious: false,
              is_core: true,
              is_wallet: true,
              time_at: 1483200000,
              amount: 0.2756765516668899,
            },
            pre_exec_version: 'v2',
            pre_exec: { success: true, error: null },
            type_send: {
              to_addr: '0xf89e7b1d6d5462fdcb9c3e68954af80d13676e46',
              token_symbol: 'ETH',
              token_amount: 0,
              token: {
                id: 'eth',
                chain: 'eth',
                name: 'ETH',
                symbol: 'ETH',
                display_symbol: null,
                optimized_symbol: 'ETH',
                decimals: 18,
                logo_url:
                  'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
                protocol_id: '',
                price: 2311.08,
                price_24h_change: 0.023788639927703716,
                credit_score: 100000000,
                is_verified: true,
                is_scam: false,
                is_suspicious: false,
                is_core: true,
                is_wallet: true,
                time_at: 1483200000,
                raw_amount: 0,
                raw_amount_hex_str: '0x0',
              },
            },
            trace_id: '72212df9ac2f417c8877fe99ffbb71d1',
            approvalId: 'e068591e-e04b-49a3-9f38-e4664f44bf2b',
            calcSuccess: true,
          },
          action: {
            actionData: {
              send: {
                to: '0xf89e7b1d6d5462fdcb9c3e68954af80d13676e46',
                token: {
                  id: 'eth',
                  chain: 'eth',
                  name: 'ETH',
                  symbol: 'ETH',
                  display_symbol: null,
                  optimized_symbol: 'ETH',
                  decimals: 18,
                  logo_url:
                    'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
                  protocol_id: '',
                  price: 2311.08,
                  price_24h_change: 0.023788639927703716,
                  credit_score: 100000000,
                  is_verified: true,
                  is_scam: false,
                  is_suspicious: false,
                  is_core: true,
                  is_wallet: true,
                  time_at: 1483200000,
                  amount: 0,
                  raw_amount: '0',
                },
              },
            },
            requiredData: {
              eoa: null,
              cex: {
                id: 'binance',
                logo: 'https://static.debank.com/image/cex/logo_url/binance/cfa71c75835c750c186010fb19707859.png',
                name: 'Binance',
                bornAt: 1690187848,
                isDeposit: true,
                supportToken: true,
              },
              contract: null,
              usd_value: 31.852407550655588,
              protocol: null,
              hasTransfer: false,
              usedChains: [
                {
                  born_at: 1690187848,
                  id: 'arb',
                  community_id: 42161,
                  name: 'Arbitrum',
                  native_token_id: 'arb',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/arb/854f629937ce94bebeb2cd38fb336de7.png',
                  wrapped_token_id:
                    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
                  is_support_history: true,
                },
                {
                  born_at: 1690189289,
                  id: 'btt',
                  community_id: 199,
                  name: 'BitTorrent',
                  native_token_id: 'btt',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/btt/2130a8d57ff2a0f3d50a4ec9432897c6.png',
                  wrapped_token_id:
                    '0x197a4ed2b1bb607e47a144b9731d7d34f86e9686',
                  is_support_history: false,
                },
                {
                  born_at: 1694267483,
                  id: 'eth',
                  community_id: 1,
                  name: 'Ethereum',
                  native_token_id: 'eth',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/eth/42ba589cd077e7bdd97db6480b0ff61d.png',
                  wrapped_token_id:
                    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                  is_support_history: true,
                },
                {
                  born_at: 1690189286,
                  id: 'celo',
                  community_id: 42220,
                  name: 'Celo',
                  native_token_id: 'celo',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/celo/41da5c1d3c0945ae822a1f85f02c76cf.png',
                  wrapped_token_id:
                    '0x471ece3750da237f93b8e339c536989b8978a438',
                  is_support_history: false,
                },
                {
                  born_at: 1690189295,
                  id: 'xdai',
                  community_id: 100,
                  name: 'Gnosis Chain',
                  native_token_id: 'xdai',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/xdai/43c1e09e93e68c9f0f3b132976394529.png',
                  wrapped_token_id:
                    '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
                  is_support_history: true,
                },
                {
                  born_at: 1694267523,
                  id: 'matic',
                  community_id: 137,
                  name: 'Polygon',
                  native_token_id: 'matic',
                  logo_url:
                    'https://static.debank.com/image/chain/logo_url/matic/52ca152c08831e4765506c9bd75767e8.png',
                  wrapped_token_id:
                    '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
                  is_support_history: true,
                },
              ],
              isTokenContract: false,
              name: null,
              onTransferWhitelist: false,
              whitelistEnable: true,
            },
          },
        },
      ],
    } as any;

    store.transactions?.forEach(tx => {
      if (!isSameAddress(address, tx.address)) {
        return;
      }
      if (chainId != null && tx.chainId !== chainId) {
        return;
      }
      if (nonce != null && tx.nonce !== nonce) {
        return;
      }
      const group = groups.find(
        g =>
          g.address === tx.address &&
          g.nonce === tx.nonce &&
          g.chainId === tx.chainId,
      );
      if (group) {
        group.txs.push(tx);
      } else {
        groups.push(new TransactionGroup({ txs: [tx] }));
      }
    });
    return groups;
  }

  getNonceByChain(address: string, chainId: number) {
    const list = this.getTransactionGroups({
      address,
      chainId,
    });
    const maxNonceTx = maxBy(
      list.filter(item => {
        return !item.isSubmitFailed && !item.isWithdrawed;
      }),
      item => item.nonce,
    );

    const firstSigningTx = this._signingTxList.find(item => {
      return item.rawTx.chainId === chainId && !item.isSubmitted;
    });
    const processingTx = this._signingTxList.find(
      item => item.rawTx.chainId === chainId && item.isSubmitted,
    );

    if (!maxNonceTx) return null;

    const maxLocalNonce = maxNonceTx.nonce;
    const firstSigningNonce =
      parseInt(firstSigningTx?.rawTx.nonce ?? '0', 0) ?? 0;
    const processingNonce = parseInt(processingTx?.rawTx.nonce ?? '0', 0) ?? 0;

    const maxLocalOrProcessingNonce = Math.max(maxLocalNonce, processingNonce);

    if (maxLocalOrProcessingNonce < firstSigningNonce) {
      return firstSigningNonce;
    }

    return maxLocalOrProcessingNonce + 1;
  }

  async getList(
    address: string,
  ): Promise<{ pendings: TransactionGroup[]; completeds: TransactionGroup[] }> {
    const groups = this.getTransactionGroups({
      address,
    });

    return {
      pendings: sortBy(
        groups.filter(item => item.isPending),
        'createdAt',
      ),
      completeds: sortBy(
        groups.filter(item => !item.isPending),
        'createdAt',
      ),
    };
  }

  addTx(tx: TransactionHistoryItem) {
    console.log(JSON.stringify(tx));
    this.setStore(draft => {
      draft.push(tx);
    });
  }

  addSigningTx(tx: Tx) {
    const id = nanoid();

    this._signingTxList.push({
      rawTx: tx,
      id,
    });

    return id;
  }

  getSigningTx(id: string) {
    return this._signingTxList.find(item => item.id === id);
  }

  removeSigningTx(id: string) {
    this._signingTxList = this._signingTxList.filter(item => item.id !== id);
  }

  removeAllSigningTx() {
    this._signingTxList = [];
  }

  updateSigningTx(
    id: string,
    data: {
      explain?: Partial<TransactionSigningItem['explain']>;
      rawTx?: Partial<TransactionSigningItem['rawTx']>;
      action?: {
        actionData: any;
        requiredData: any;
      };
      isSubmitted?: boolean;
    },
  ) {
    const target = this._signingTxList.find(item => item.id === id);
    if (target) {
      target.rawTx = {
        ...target.rawTx,
        ...data.rawTx,
      };
      target.explain = {
        ...target.explain,
        ...data.explain,
      } as TransactionSigningItem['explain'];
      if (data.action) {
        target.action = data.action;
      }
      target.isSubmitted = data.isSubmitted;
    }
  }

  constructor(options?: StorageAdapaterOptions) {
    this.store = createPersistStore<TxHistoryStore>(
      {
        name: 'txHistory',
        template: {
          transactions: [],
        },
      },
      {
        storage: options?.storageAdapter,
      },
    );
    if (!Array.isArray(this.store.transactions)) {
      this.store.transactions = [];
    }

    // this._populateAvailableTxs();
  }

  updateTx(tx: TransactionHistoryItem) {
    this.setStore(draft => {
      const index = draft.findIndex(
        item => item.hash === tx.hash || item.reqId === tx.reqId,
      );
      if (index !== -1) {
        draft[index] = { ...tx };
      }
    });
  }

  completeTx({
    address,
    chainId,
    nonce,
    hash,
    success = true,
    gasUsed,
    reqId,
  }: {
    address: string;
    chainId: number;
    nonce: number;
    hash?: string;
    reqId?: string;
    success?: boolean;
    gasUsed?: number;
  }) {
    const target = this.getTransactionGroups({
      address,
      chainId,
      nonce,
    })?.[0];
    if (!target.isPending) {
      return;
    }

    target.isPending = false;
    target.isFailed = !success;
    if (gasUsed) {
      target.maxGasTx.gasUsed = gasUsed;
    }

    this.updateTx(target.maxGasTx);

    // this._setStoreTransaction({
    //   ...this.store.transactions,
    //   [normalizedAddress]: {
    //     ...this.store.transactions[normalizedAddress],
    //     [key]: target,
    //   },
    // });
    const chain = Object.values(CHAINS).find(
      item => item.id === Number(target.chainId),
    );
    // if (chain) {
    //   stats.report('completeTransaction', {
    //     chainId: chain.serverId,
    //     success,
    //     preExecSuccess:
    //       target.explain.pre_exec.success && target.explain.calcSuccess,
    //     createBy: target?.$ctx?.ga ? 'rabby' : 'dapp',
    //     source: target?.$ctx?.ga?.source || '',
    //     trigger: target?.$ctx?.ga?.trigger || '',
    //   });
    // }
    // this.clearBefore({ address, chainId, nonce });
  }

  async reloadTx(
    {
      address,
      chainId,
      nonce,
    }: {
      address: string;
      chainId: number;
      nonce: number;
    },
    duration: number | boolean = 0,
  ) {
    const target = this.getTransactionGroups({
      address,
      chainId,
      nonce,
    })?.[0];
    if (!target) {
      return;
    }

    const chain = Object.values(CHAINS).find(c => c.id === chainId)!;
    const { txs } = target;

    const broadcastedTxs = txs.filter(
      tx => tx && tx.hash && !tx.isSubmitFailed && !tx.isWithdrawed,
    ) as (TransactionHistoryItem & { hash: string })[];

    try {
      const results = await Promise.all(
        broadcastedTxs.map(tx =>
          openapi.getTx(
            chain.serverId,
            tx.hash!,
            Number(tx.rawTx.gasPrice || tx.rawTx.maxFeePerGas || 0),
          ),
        ),
      );
      const completed = results.find(
        result => result.code === 0 && result.status !== 0,
      );
      if (!completed) {
        if (
          duration !== false &&
          typeof duration === 'number' &&
          duration < 1000 * 15
        ) {
          // maximum retry 15 times;
          setTimeout(() => {
            this.reloadTx({ address, chainId, nonce });
          }, Number(duration) + 1000);
        }
        return;
      }
      const completedTx = txs.find(tx => tx.hash === completed.hash)!;
      this.updateTx({
        ...completedTx,
        gasUsed: completed.gas_used,
      });
      // TOFIX
      this.completeTx({
        address,
        chainId,
        nonce,
        hash: completedTx.hash,
        success: completed.status === 1,
        reqId: completedTx.reqId,
      });
      eventBus.emit(EVENTS.broadcastToUI, {
        method: EVENTS.RELOAD_TX,
        params: {
          addressList: [address],
        },
      });
    } catch (e) {
      if (
        duration !== false &&
        typeof duration === 'number' &&
        duration < 1000 * 15
      ) {
        // maximum retry 15 times;
        setTimeout(() => {
          this.reloadTx({ address, chainId, nonce });
        }, Number(duration) + 1000);
      }
    }
  }

  updateTxByTxRequest = (txRequest: TxRequest) => {
    const { chainId, from } = txRequest.signed_tx;
    const nonce = txRequest.nonce;

    const target = this.getTransactionGroups({
      address: from,
      chainId,
      nonce,
    })?.[0];
    if (!target) {
      return;
    }

    const tx = target.txs.find(
      item => item.reqId && item.reqId === txRequest.id,
    );

    if (!tx) {
      return;
    }

    const isSubmitFailed =
      txRequest.push_status === 'failed' && txRequest.is_finished;

    this.updateTx({
      ...tx,
      hash: txRequest.tx_id || undefined,
      isWithdrawed:
        txRequest.is_withdraw ||
        (txRequest.is_finished && !txRequest.tx_id && !txRequest.push_status),
      isSubmitFailed: isSubmitFailed,
    });
  };

  reloadTxRequest = async ({
    address,
    chainId,
    nonce,
  }: {
    address: string;
    chainId: number;
    nonce: number;
  }) => {
    const key = `${chainId}-${nonce}`;
    const from = address.toLowerCase();
    const target = this.store.transactions[from][key];
    const chain = Object.values(CHAINS).find(c => c.id === chainId)!;
    console.log('reloadTxRequest', target);
    if (!target) {
      return;
    }
    const { txs } = target;
    const unbroadcastedTxs = txs.filter(
      tx =>
        tx && tx.reqId && !tx.hash && !tx.isSubmitFailed && !tx.isWithdrawed,
    ) as (TransactionHistoryItem & { reqId: string })[];

    console.log('reloadTxRequest', unbroadcastedTxs);
    if (unbroadcastedTxs.length) {
      const service = chain?.isTestnet ? testOpenapi : openapi;
      await service
        .getTxRequests(unbroadcastedTxs.map(tx => tx.reqId))
        .then(res => {
          res.forEach((item, index) => {
            this.updateTxByTxRequest(item);

            eventBus.emit(EVENTS.broadcastToUI, {
              method: EVENTS.RELOAD_TX,
              params: {
                addressList: [address],
              },
            });
          });
        })
        .catch(e => console.error(e));
    }
  };
}

export class TransactionGroup {
  txs: TransactionHistoryItem[];

  constructor({ txs }: { txs: TransactionHistoryItem[] }) {
    this.txs = txs;
  }

  get address() {
    return this.txs[0].address;
  }
  get nonce() {
    return this.txs[0].nonce;
  }
  get chainId() {
    return this.txs[0].chainId;
  }

  get maxGasTx() {
    return findMaxGasTx(this.txs);
  }

  get originTx() {
    return minBy(this.txs, 'createdAt');
  }

  get isPending() {
    return !!this.maxGasTx.isPending;
  }

  set isPending(v: boolean) {
    this.maxGasTx.isPending = v;
  }
  get isSubmitFailed() {
    return !!this.maxGasTx.isSubmitFailed;
  }

  set isSubmitFailed(v: boolean) {
    this.maxGasTx.isSubmitFailed = v;
  }

  get isWithdrawed() {
    return !!this.maxGasTx.isWithdrawed;
  }

  set isWithdrawed(v: boolean) {
    this.maxGasTx.isWithdrawed = v;
  }

  get isFailed() {
    return !!this.maxGasTx.isFailed;
  }

  set isFailed(v: boolean) {
    this.maxGasTx.isFailed = v;
  }

  get createdAt() {
    return minBy(this.txs, 'createdAt')?.createdAt || 0;
  }
}
