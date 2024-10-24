import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { RcIconHeaderSettings } from '@/assets/icons/home';
import { HeaderButtonProps } from '@react-navigation/native-stack/lib/typescript/src/types';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React from 'react';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const ImportMoreAddressScreenButton: React.FC<HeaderButtonProps> = ({
  tintColor,
}) => {
  const state = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.ImportMoreAddress)?.params,
  ) as {
    type: KEYRING_TYPE;
    brand: string;
    keyringId?: number;
  };

  const settingModalName = React.useMemo(() => {
    switch (state.type) {
      case KEYRING_TYPE.HdKeyring:
        return MODAL_NAMES.SETTING_HDKEYRING;
      case KEYRING_TYPE.LedgerKeyring:
        return MODAL_NAMES.SETTING_LEDGER;
      case KEYRING_TYPE.OneKeyKeyring:
        return MODAL_NAMES.SETTING_ONEKEY;
      case KEYRING_TYPE.KeystoneKeyring:
      default:
        return MODAL_NAMES.SETTING_KEYSTONE;
    }
  }, [state.type]);

  return (
    <CustomTouchableOpacity
      hitSlop={hitSlop}
      onPress={() => {
        const id = createGlobalBottomSheetModal({
          name: settingModalName,
          brand: state.brand,
          onDone: () => {
            removeGlobalBottomSheetModal(id);
          },
          ...(state.type ? { keyringId: state.keyringId } : {}),
        });
      }}>
      <RcIconHeaderSettings width={24} height={24} color={tintColor} />
    </CustomTouchableOpacity>
  );
};
