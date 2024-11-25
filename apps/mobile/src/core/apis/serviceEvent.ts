import { BroadcastEvent } from '@/constant/event';
import { ServiceEvent } from '@rabby-wallet/biz-utils';

const enum AppServiceEvent {
  foo = 'foo',
}

type FromBroadcast = `srvEvent:${BroadcastEvent}`;

export const globalSerivceEvents = new ServiceEvent<
  FromBroadcast | AppServiceEvent
>();
