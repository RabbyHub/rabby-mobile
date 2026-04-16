import type { TokenItemWithEntity } from '@rabby-wallet/rabby-api/dist/types';

import { openapi } from '@/core/request';
import type { TransactionHistoryItem } from '@/core/history/txTypes';
import { LocalHistoryItemEntity } from '@/databases/entities/localhistoryItem';
import { patchSingleToken } from '@/databases/sync/tokenPatch';

export const loadTxSaveFromLocalStore = async (tx: TransactionHistoryItem) => {
  try {
    const actionData = tx.action?.actionData;
    if (!actionData?.send) {
      return;
    }

    const item = new LocalHistoryItemEntity();
    LocalHistoryItemEntity.fillEntityFromLocalSend(item, tx);
    const repo = LocalHistoryItemEntity.getRepository();
    await repo.manager.save(item);
  } catch (e) {
    console.log('loadTxSaveFromLocalStore error', e);
  }
};

export const txDonePatchTokenAmountInDb = async (
  tx: TransactionHistoryItem,
) => {
  try {
    const sendTokenList = tx.explain?.balance_change?.send_token_list;
    const receiveTokenList = tx.explain?.balance_change?.receive_token_list;
    const tokenList = [...(sendTokenList || []), ...(receiveTokenList || [])];

    void Promise.allSettled(
      tokenList.map(async token => {
        try {
          const tokenRes = (await openapi.getToken(
            tx.address,
            token.chain,
            token.id,
          )) as TokenItemWithEntity;
          const cexIds = tokenRes.identity?.cex_list?.map(item => item.id);
          tokenRes.cex_ids = cexIds || [];
          if (tokenRes) {
            await patchSingleToken(tx.address, tokenRes);
          }
        } catch (error) {
          console.error(
            `Failed to patch token ${token.id} for ${tx.address}:`,
            error,
          );
        }
      }),
    );
  } catch (e) {
    console.log('txDonePatchTokenAmountInDb error', e);
  }
};
