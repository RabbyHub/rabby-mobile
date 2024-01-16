import { sessionService } from '../services/session';
import { BroadcastEvent } from '@/constant/event';

export function removeConnectedSite(origin: string) {
  sessionService.broadcastEvent(BroadcastEvent.accountsChanged, [], origin);
}
