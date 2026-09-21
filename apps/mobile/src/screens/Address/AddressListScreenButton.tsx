import { TouchableOpacity } from 'react-native';
import { navigateDeprecated } from '@/utils/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { RootNames } from '@/constant/layout';
import WalletSVG from '@/assets2024/icons/common/wallet-cc.svg';
import { apiGlobalModal } from '@/components2024/GlobalBottomSheetModal/apiGlobalModal';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';

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
    paddingHorizontal: 8,
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
      onPress={onPress}
      {...makeTestIDProps(
        type === 'address' ? E2E_ID.home.addAddressButton : null,
      )}>
      <WalletSVG width={22} height={22} color={colors2024['neutral-title-1']} />
    </TouchableOpacity>
  );
};
