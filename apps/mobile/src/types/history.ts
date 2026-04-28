import type {
  TokenItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import type { KeyringAccountWithAlias } from '@/types/account';

export enum HistoryItemCateType {
  Send = 'send',
  Approve = 'approve',
  Recieve = 'receive',
  Revoke = 'revoke',
  Bridge = 'bridge',
  Swap = 'swap',
  Contract = 'contract',
  UnKnown = 'interaction',
  Cancel = 'cancel',
  Buy = 'buy',
  GAS_DEPOSIT = 'gas_deposit',
  GAS_WITHDRAW = 'gas_withdraw',
  GAS_RECEIVED = 'gas_received',
}

export enum CUSTOM_HISTORY_ACTION {
  LENDING = 'LENDING',
}

export enum CUSTOM_HISTORY_TITLE_TYPE {
  LENDING_WITHDRAW = 'LENDING_WITHDRAW',
  LENDING_REPAY = 'LENDING_REPAY',
  LENDING_BORROW = 'LENDING_BORROW',
  LENDING_SUPPLY = 'LENDING_SUPPLY',
  LENDING_ON_COLLATERAL = 'LENDING_ON_COLLATERAL',
  LENDING_OFF_COLLATERAL = 'LENDING_OFF_COLLATERAL',
  LENDING_MANAGE_EMODE = 'LENDING_MANAGE_EMODE',
  LENDING_MANAGE_EMODE_DISABLE = 'LENDING_MANAGE_EMODE_DISABLE',
  LENDING_DEBT_SWAP = 'LENDING_DEBT_SWAP',
  LENDING_REPAY_WITH_COLLATERAL = 'LENDING_REPAY_WITH_COLLATERAL',
}

export type LocalSendHistorySource = {
  address: string;
  chainId: number;
  hash?: string;
  isFailed?: boolean;
  completedAt?: number;
  gasUSDValue?: number;
  gasTokenCount?: number;
  action?: {
    actionData?: {
      send?: {
        to?: string;
        token: {
          raw_amount?: string;
          decimals?: number;
          id?: string;
          price?: number;
        };
      };
    };
  };
  $ctx?: {
    ga?: {
      source?: string;
    };
  };
};

export type TokenPatchHistorySource = {
  address: string;
  explain?: {
    balance_change?: {
      send_token_list?: { chain: string; id: string }[];
      receive_token_list?: { chain: string; id: string }[];
    };
  };
};

export type HistorySyncTxSource = LocalSendHistorySource &
  TokenPatchHistorySource;

export type ProjectItemType = {
  chain: string;
  id: string;
  logo_url: string;
  name: string;
};

export interface HistoryDisplayItem extends Omit<TxHistoryItem, 'tx'> {
  tx:
    | (TxHistoryItem['tx'] & {
        id?: string;
      })
    | null;
  receives: {
    amount: number;
    from_addr: string;
    token_id: string;
    price?: number;
    token: TokenItem;
  }[];
  sends: {
    amount: number;
    to_addr: string;
    token_id: string;
    price?: number;
    token: TokenItem;
  }[];
  time_at: number;
  token_approve: {
    spender: string;
    token_id: string;
    value: number;
    price?: number;
    token?: TokenItem;
  } | null;
  address: string;
  project_item: ProjectItemType | null;
  key: string;
  isSmallUsdTx?: boolean;
  cateDict?: Record<string, string>;
  account?: KeyringAccountWithAlias;
  isShowSuccess?: boolean;
  historyType: HistoryItemCateType;
  historyCustomType?: CUSTOM_HISTORY_TITLE_TYPE;
}

export type TokenChangeDataItem = {
  amount: number;
  token?: TokenItem;
  token_id: string;
  price?: number;
  type: 'send' | 'receive' | 'approve';
};
