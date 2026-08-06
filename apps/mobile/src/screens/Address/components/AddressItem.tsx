import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import MoreSVG from '@/assets/icons/home/more-cc.svg';
import { addressUtils } from '@rabby-wallet/base-utils';
import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { AddressItemContextMenu } from './AddressItemContextMenu';
import { AddressItemInner2024 } from './AddressItemInner2024';
import { AddressItemShadowView } from './AddressItemShadowView';
import { isTabsSwiping } from './MultiAssets/hooks';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';

const { isSameAddress } = addressUtils;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  root: {
    overflow: 'hidden',
  },
  itemContainer: {
    position: 'relative',
  },
  itemWithManageButton: {
    borderRadius: 20,
  },
  shadowWithManageButton: {
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.02,
        shadowRadius: 11.9,
      },
      default: {},
    }),
  },
  manageButton: {
    position: 'absolute',
    top: 26,
    right: 24,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
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
  onManage?: () => void;
  manageAccessibilityLabel?: string;
  showMarkIfNewlyAdded?: React.ComponentProps<
    typeof AddressItemInner2024
  >['showMarkIfNewlyAdded'];
  disableNavigate?: boolean;
  isShowBackupBadge?: boolean;
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
    onManage,
    manageAccessibilityLabel,
    showMarkIfNewlyAdded,
    disableNavigate,
    isShowBackupBadge = false,
  } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [isPressing, setIsPressing] = React.useState(false);

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
    if (!disableNavigate) {
      apisSingleHome.navigateToSingleHome(account);
    }
  }, [onSelect, handleGoDetail, disableNavigate, account]);

  const isCurrentAccount = React.useMemo(() => {
    return (
      lastSelectedAccount &&
      isSameAddress(lastSelectedAccount.address, account.address) &&
      lastSelectedAccount.type === account.type
    );
  }, [lastSelectedAccount, account]);

  const children = (
    <AddressItemShadowView
      style={[
        styles.shadow,
        onManage && styles.shadowWithManageButton,
        isPressing && styles.rootPressing,
      ]}>
      <View style={styles.itemContainer}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={() => !useLongPressing && setIsPressing(true)}
          onPressOut={() => setIsPressing(false)}
          style={StyleSheet.flatten([styles.root, props.style])}
          delayLongPress={200} // long press delay
          onPress={onDetail}
          onLongPress={() => {
            useLongPressing && setIsPressing(true);
            trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          }}>
          <AddressItemInner2024
            style={onManage ? styles.itemWithManageButton : undefined}
            inlineArrow={Boolean(onManage)}
            isPressing={isCurrentAccount || isPressing}
            account={account}
            changePercent={changePercent}
            isLoss={isLoss}
            showMarkIfNewlyAdded={showMarkIfNewlyAdded}
            isShowBackupBadge={isShowBackupBadge}
          />
        </TouchableOpacity>
        {onManage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={manageAccessibilityLabel}
            onPress={onManage}
            hitSlop={11}
            style={styles.manageButton}>
            <MoreSVG
              width={24}
              height={24}
              color={colors2024['neutral-title-1']}
            />
          </Pressable>
        ) : null}
      </View>
    </AddressItemShadowView>
  );
  if (disableMenu || isScrolling) {
    return children;
  }
  return (
    <AddressItemContextMenu
      account={account}
      preViewBorderRadius={onManage ? 20 : 16}
      actions={['copy', 'pin', 'edit', 'delete']}>
      {children}
    </AddressItemContextMenu>
  );
};
