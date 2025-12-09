import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { addressUtils } from '@rabby-wallet/base-utils';
import React, { useCallback } from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { AddressItemContextMenu } from './AddressItemContextMenu';
import { AddressItemInner2024 } from './AddressItemInner2024';
import { AddressItemShadowView } from './AddressItemShadowView';
import { isTabsSwiping } from './MultiAssets/hooks';
import { useAddressDetailModal } from '../useAddressDetailModal';
import { toast } from '@/components2024/Toast';
import { useTranslation } from 'react-i18next';

const { isSameAddress } = addressUtils;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  root: {
    overflow: 'hidden',
  },
  shadow: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
    backgroundColor: colors2024['brand-light-1'],
  },
}));

interface AddressItemProps {
  account: KeyringAccountWithAlias;
  changePercent?: string;
  isLoss?: boolean;
  lastSelectedAccount?: KeyringAccountWithAlias;
  style?: StyleProp<ViewStyle>;
  isScrolling?: boolean;
  disableMenu?: boolean;
  onSelect?: () => void;
  useLongPressing?: boolean;
  handleGoDetail?: () => void;
  isManageMode?: boolean;
}
export const AddressItemEntry = (props: AddressItemProps) => {
  const {
    account,
    lastSelectedAccount,
    onSelect,
    changePercent,
    isLoss,
    disableMenu,
    isScrolling,
    useLongPressing,
    handleGoDetail,
    isManageMode,
  } = props;
  const { styles } = useTheme2024({ getStyle });
  const [isPressing, setIsPressing] = React.useState(false);
  const showAddressDetail = useAddressDetailModal();
  const { t } = useTranslation();

  const onDetail = useCallback(() => {
    if (isTabsSwiping.value) {
      return;
    }
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    onSelect?.();
    handleGoDetail?.();
    navigateDeprecated(RootNames.SingleAddressStack, {
      screen: RootNames.SingleAddressHome,
      params: {
        account,
      },
    });
  }, [account, onSelect, handleGoDetail]);

  const showAddressDetailPopup = () => {
    showAddressDetail({
      account: account,
      onDelete: () => {
        toast.success(t('global.Deleted'));
      },
    });
  };

  const isCurrentAccount = React.useMemo(() => {
    return (
      lastSelectedAccount &&
      isSameAddress(lastSelectedAccount.address, account.address) &&
      lastSelectedAccount.type === account.type
    );
  }, [lastSelectedAccount, account]);

  const children = (
    <AddressItemShadowView
      style={[styles.shadow, isPressing && styles.rootPressing]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => !useLongPressing && setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        style={StyleSheet.flatten([styles.root, props.style])}
        delayLongPress={200} // long press delay
        onPress={isManageMode ? showAddressDetailPopup : onDetail}
        onLongPress={() => {
          useLongPressing && setIsPressing(true);
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }}>
        <AddressItemInner2024
          isPressing={isCurrentAccount || isPressing}
          account={account}
          changePercent={changePercent}
          isLoss={isLoss}
          isManageMode={isManageMode}
        />
      </TouchableOpacity>
    </AddressItemShadowView>
  );
  if (disableMenu || isScrolling) {
    return children;
  }
  return (
    <AddressItemContextMenu
      account={account}
      preViewBorderRadius={16}
      actions={['copy', 'pin', 'edit', 'delete']}>
      {children}
    </AddressItemContextMenu>
  );
};
