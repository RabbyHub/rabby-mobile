import { RootNames } from '@/constant/layout';
import { KeyringAccountWithAlias, useCurrentAccount } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
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
  disableMenu?: boolean;
  onSelect?: () => void;
  disableClick?: boolean;
}
export const AddressItemEntry = (props: AddressItemProps) => {
  const {
    account,
    lastSelectedAccount,
    onSelect,
    changePercent,
    isLoss,
    disableMenu,
    disableClick,
  } = props;
  const { switchAccount } = useCurrentAccount();
  const { styles } = useTheme2024({ getStyle });
  const [isPressing, setIsPressing] = React.useState(false);

  const onDetail = useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    switchAccount(account);
    onSelect?.();
    navigate(RootNames.SingleAddressStack, {
      screen: RootNames.SingleAddressHome,
    });
  }, [account, onSelect, switchAccount]);

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
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        style={StyleSheet.flatten([styles.root, props.style])}
        delayLongPress={200} // long press delay
        onPress={disableClick ? undefined : onDetail}
        onLongPress={() => {
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
        />
      </TouchableOpacity>
    </AddressItemShadowView>
  );
  if (disableMenu) {
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
