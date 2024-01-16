import { BasicDappInfo, DappInfo } from '@rabby-wallet/service-dapp';
import { dappService } from '../services';
import { sessionService } from '../services/session';
import { BroadcastEvent } from '@/constant/event';
import { CHAINS_ENUM } from '@debank/common';
import { openapi } from '../request';

export function removeConnectedSite(origin: string) {
  sessionService.broadcastEvent(BroadcastEvent.accountsChanged, [], origin);
}

export const fetchDappInfo = async (origin: string) => {
  const res = await openapi.getDappsInfo({
    ids: [origin.replace(/^https?:\/\//, '')],
  });

  return res?.[0];
};

export const createDappBySession = ({
  origin,
  name,
  icon,
}: {
  origin: string;
  name: string;
  icon: string;
}): DappInfo => {
  const id = origin.replace(/^https?:\/\//, '');
  return {
    origin,
    chainId: CHAINS_ENUM.ETH,
    info: {
      id,
      name: name || '',
      logo_url: icon || '',
      description: '',
      user_range: '',
      tags: [],
      // chain_ids: [],
    },
  };
};

export const syncBasicDappInfo = async (origin: string) => {
  const info = await fetchDappInfo(origin);
  if (info) {
    dappService.patchDapp(origin, {
      info,
    });
  }
};
