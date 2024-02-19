import EventEmitter from 'events';
import { SIGN_HELPER_EVENTS } from '@rabby-wallet/service-keyring';

export const eventBus = new EventEmitter();

export const EVENTS = SIGN_HELPER_EVENTS;
