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
