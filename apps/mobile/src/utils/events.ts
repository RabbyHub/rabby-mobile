import EventEmitter from 'events';
import { SIGN_HELPER_EVENTS } from '@rabby-wallet/service-keyring';

export const eventBus = new EventEmitter();

export const EVENTS = SIGN_HELPER_EVENTS;

export const APPROVAL_STATUS_MAP = {
  PENDING: 1,
  CONNECTED: 2,
  WAITING: 3,
  SUBMITTED: 4,
  REJECTED: 5,
  FAILED: 6,
  SUBMITTING: 7,
};

export const EVENT_ACTIVE_WINDOW = 'EVENT_ACTIVE_WINDOW';

export const EVENT_SWITCH_ACCOUNT = 'EVENT_SWITCH_ACCOUNT';

export const EVENT_UPDATE_CHAIN_LIST = 'EVENT_UPDATE_CHAIN_LIST';
