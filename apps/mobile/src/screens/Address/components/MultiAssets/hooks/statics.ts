import { getAllMyAccount } from '@/core/apis/address';
import { preferenceService } from '@/core/services';
import { zCreate } from '@/core/utils/reexports';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { getSortedAddressList } from '@/hooks/account';
import { AbstractPortfolioToken } from '@/screens/Home/types';

type TokenStatics = {
  addresses: string[];
  total_core_usd_value: number;
  threshold: number;
  core_token_count: number;
  threshold_db_id: null | string;
};

type TaggedRow = Pick<
  TokenItemEntity,
  '_db_id' | 'id' | 'chain' | 'owner_addr'
>;

type TokenVariedRows = {
  $fold_token_rows: TaggedRow[];
  unfold_token_rows: TaggedRow[];
  fold_and_include_balance: TaggedRow[];
  fold_and_exclude_balance: TaggedRow[];
  scam: TaggedRow[];
};

type TokensMetaState = TokenVariedRows & {
  statics: TokenStatics | null;
};

const inMemTokenMetaStore = zCreate<TokensMetaState>(() => ({
  $fold_token_rows: [],
  unfold_token_rows: [],
  fold_and_include_balance: [],
  fold_and_exclude_balance: [],
  scam: [],

  statics: null,
}));

async function updateInMemTokenMetaStore(tokens: AbstractPortfolioToken[]) {
  const tokenSettings = preferenceService.getUserTokenSettings() || {};
  const top10Addresses = new Set(
    (await getSortedAddressList()).allMyAccounts
      .slice(0, 10)
      .map(item => item.address.toLowerCase()),
  );
}
