import type {
  ExplainTxResponse,
  Tx,
  TxPushType,
} from '@rabby-wallet/rabby-api/dist/types';
import type {
  ActionRequireData,
  ParsedActionData,
} from '@rabby-wallet/rabby-action';
import type { Object as ObjectType } from 'ts-toolbelt';
import type { KeyringTypeName } from '@rabby-wallet/keyring-utils';

import type { DappInfo } from '@/core/services/dappService';

export interface TransactionHistoryItem {
  address: string;
  chainId: number;
  nonce: number;

  rawTx: Tx;
  createdAt: number;
  completedAt?: number;
  hash?: string;

  gasTokenSymbol?: string;
  gasUSDValue?: number;
  gasTokenCount?: number;

  gasUsed?: number;
  site?: DappInfo;

  pushType?: TxPushType;
  reqId?: string;

  isPending?: boolean;
  isWithdrawed?: boolean;
  isFailed?: boolean;
  isSubmitFailed?: boolean;
  isCompleted?: boolean;

  isSynced?: boolean;

  explain?: ObjectType.Merge<
    ExplainTxResponse,
    { approvalId: string; calcSuccess: boolean }
  >;
  action?: {
    actionData: ParsedActionData;
    requiredData: ActionRequireData;
  };

  $ctx?: any;
  keyringType?: KeyringTypeName;
}
