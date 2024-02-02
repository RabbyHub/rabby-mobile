import { SessionProp } from './../services/session';
import { DappInfo } from '@/core/services/dappService';
import { dappService } from '../services';
import { sessionService } from '../services/session';
import { BroadcastEvent } from '@/constant/event';
import { CHAINS_ENUM } from '@debank/common';
import { openapi } from '../request';
import { BasicDappInfo } from '@rabby-wallet/rabby-api/dist/types';

export const removeDapp = (origin: string) => {
  disconnect(origin);
  dappService.removeDapp(origin);
};

export const disconnect = (origin: string) => {
  if (!dappService.hasPermission(origin)) {
    return;
  }
  sessionService.broadcastEvent(BroadcastEvent.accountsChanged, [], origin);
  dappService.disconnect(origin);
};

export const connect = ({
  origin,
  session,
  info,
  chainId,
}: {
  origin;
  chainId: CHAINS_ENUM;
  session?: SessionProp;
  info?: BasicDappInfo;
}) => {
  const dapp = dappService.getDapp(origin);
  if (dapp) {
    dappService.patchDapp(origin, {
      chainId,
      isConnected: true,
    });
    return;
  }
  if (info) {
    dappService.addDapp({
      origin,
      info,
      isConnected: true,
      chainId,
    });
    return;
  }
  dappService.addDapp({
    ...createDappBySession(
      session || {
        name: '',
        origin,
        icon: '',
      },
    ),
    isConnected: true,
    chainId,
  });
  syncBasicDappInfo(origin);
};

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
      chain_ids: [],
    },
  };
};

export const syncBasicDappInfo = async (origin: string | string[]) => {
  const input = Array.isArray(origin) ? origin : [origin];
  const ids = input
    .filter(item => !!item)
    .map(item => item.replace(/^https?:\/\//, ''));

  if (!ids.length) {
    return;
  }

  const res = await openapi.getDappsInfo({
    ids: ids,
  });
  res.forEach(item => {
    dappService.patchDapp(`https://${item.id}`, {
      info: item,
    });
  });
};
