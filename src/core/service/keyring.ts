import WatchKeyring from '@rabby-wallet/eth-watch-keyring';
import { KeyringController } from '../../packages/keyring-controller/keyring-controller';

export const KEYRING_SDK_TYPES = {
  WatchKeyring,
};

export const keyringController = new KeyringController({
  keyringTypes: [WatchKeyring],
  onGenerateAliasName: () => {
    return '';
  },
  onSetAddressAlias: () => {
    return '';
  },
  preferenceController: {},
});
