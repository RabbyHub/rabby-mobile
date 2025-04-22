import { transactionHistoryService } from '@/core/services';
import { LocalHistoryItemEntity } from '@/databases/entities/localhistoryItem';
import { useEffect, useState } from 'react';

export const useRecentSend = (top10Address: string[]) => {
  const [sendHistory, setSendHistory] = useState<LocalHistoryItemEntity[]>([]);
  useEffect(() => {
    // TODO: back here replace to this
    // const list = transactionHistoryService.batchSendList({
    //   addresses: top10Address,
    //   limit: 3,
    // });
    // console.log('🔍 CUSTOM_LOGGER:=>: list', list.length);
    LocalHistoryItemEntity.batchMultAddressSend(top10Address).then(res => {
      setSendHistory(res);
      console.log('🔍 CUSTOM_LOGGER:=>: batchMultAddressSend', res);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top10Address.length]);
  return {
    sendHistory,
  };
};
