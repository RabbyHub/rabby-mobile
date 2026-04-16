import type { Result } from '@rabby-wallet/rabby-security-engine';
import type {
  ActionRequireData,
  ParsedTransactionActionData,
  ParsedTypedDataActionData,
} from '@rabby-wallet/rabby-action';

export interface MultiActionProps {
  actionList: ParsedTypedDataActionData[] | ParsedTransactionActionData[];
  requireDataList: ActionRequireData[];
  engineResultList: Result[][];
}
