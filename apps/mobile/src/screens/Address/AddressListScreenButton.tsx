import { TouchableOpacity } from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/core';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { navigateDeprecated } from '@/utils/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { AppRootName, RootNames } from '@/constant/layout';
import {
  shouldRedirectToSetPasswordBefore2024,
  useSetPasswordFirst,
} from '@/hooks/useLock';
import { CurrentAddressProps } from './components/AddressListScreenContainer';
import WalletSVG from '@/assets2024/icons/common/wallet-cc.svg';
import { apiGlobalModal } from '@/components2024/GlobalBottomSheetModal/apiGlobalModal';

export interface Props {
  type: 'address' | 'watch-address' | 'safe-address';
}

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerRight: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerRightText: {
    color: colors2024['brand-default'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));

export const AddressListScreenButton: React.FC<Props> = ({
  type = 'address',
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const onPress = React.useCallback(() => {
    switch (type) {
      case 'address':
        apiGlobalModal.showAddSelectMethodModal();
        break;
      case 'watch-address':
        navigateDeprecated(RootNames.StackAddress, {
          screen: RootNames.ImportWatchAddress2024,
        });
        break;
      case 'safe-address':
        navigateDeprecated(RootNames.StackAddress, {
          screen: RootNames.ImportSafeAddress2024,
        });
        break;
      default:
      // NOTHING
    }
  }, [type]);
  return (
    <TouchableOpacity
      style={styles.headerRight}
      hitSlop={hitSlop}
      onPress={onPress}>
      <WalletSVG width={22} height={22} color={colors2024['neutral-title-1']} />
    </TouchableOpacity>
  );
};
