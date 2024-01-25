import WatchKeyring from '@rabby-wallet/eth-keyring-watch';
// eslint-disable-next-line n/no-extraneous-import
import type { KeyringIntf } from '@rabby-wallet/keyring-utils';

export const keyringSdks = {
  WatchKeyring,
} as const;

/** @deprecated just for compatibility on COPY codes from extension, use keyringSdks as possible */
export const KEYRING_SDK_TYPES = keyringSdks;

export type KeyringClassType = (typeof keyringSdks)[keyof typeof keyringSdks];

export type KeyringInstance = InstanceType<KeyringClassType> | KeyringIntf;
