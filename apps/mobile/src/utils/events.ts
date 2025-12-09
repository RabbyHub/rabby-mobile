import { SIGN_HELPER_EVENTS } from '@rabby-wallet/service-keyring';
import { makeEEClass } from '@/core/apis/event';

import { type Purchase } from 'react-native-iap';
import { DB } from '@op-engineering/op-sqlite';

export type AssetsRefresthState = {
  singleTokenNonce: number;
  singleDeFiNonce: number;
  singleNFTNonce: number;
  tokenNonce: number;
  deFiNonce: number;
  nftNonce: number;
};
export type EventBusListeners = {
  [EVENTS.TX_COMPLETED]: (txDetail: {
    address: string;
    hash: string;
    gasUsed?: number;
  }) => void;
  [EVENTS.PURCHASE_UPDATED]: (detail: {
    data: Purchase;
    error?: Error;
  }) => void;
  [EVENTS.QRHARDWARE.ACQUIRE_MEMSTORE_SUCCEED]: (detail: {
    request: any;
  }) => void;
  [EVENT_ACTIVE_WINDOW]: (id?: string | null) => void;
  EVENT_REFRESH_ASSET: (type: keyof AssetsRefresthState) => void;
  __OP_SQLITE_LOADED__: (ctx: { database: DB }) => void;
};
type Listeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: EE } = makeEEClass<EventBusListeners & Listeners>();
export const eventBus = new EE();

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

export const EVENT_MINI_APPROVAL_START_SIGN = 'EVENT_MINI_APPROVAL_START_SIGN';

export const EVENT_PAY_GAS_BY_GAS_ACCOUNT_AND_NOT_CAN_PAY =
  'EVENT_PAY_GAS_BY_GAS_ACCOUNT_AND_NOT_CAN_PAY';

export const EVENT_SHOW_BROWSER = 'EVENT_SHOW_BROWSER';

export const EVENT_SHOW_BROWSER_MANAGE = 'EVENT_SHOW_BROWSER_MANAGE';

export const EVENT_BROWSER_ACTION = 'EVENT_BROWSER_ACTION';
