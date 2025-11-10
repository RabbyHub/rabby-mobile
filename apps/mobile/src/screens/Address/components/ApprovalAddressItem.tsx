import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { trigger } from 'react-native-haptic-feedback';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { Card } from '@/components2024/Card';
import { BadgeText } from '@/screens/Home/components/BadgeText';
import { useTranslation } from 'react-i18next';
import { AddressItemShadowView } from './AddressItemShadowView';
import { ArrowCircleCC } from '@/assets2024/icons/address';
import { isNumber } from 'lodash';
import LinearGradient from 'react-native-linear-gradient';
import { Skeleton } from '@rneui/themed';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-bg-3'],
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    borderRadius: 0,
    flex: 1,
    flexGrow: 1,
    padding: 16,
    paddingRight: 24,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
    marginRight: 20,
  },
  item: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  itemInfo: {
    gap: 4,
    flexGrow: 1,
    flex: 1,
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  approvalCount: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  itemNameTextHasPinned: {
    paddingRight: 52,
  },
  itemNamePinned: {
    marginLeft: -52,
  },
  itemBalanceText: {
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
  },
  badgeStyle: {
    width: 20,
    lineHeight: 20,
    height: 20,
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardPressing: {
    backgroundColor: colors2024['brand-light-1'],
  },
  arrowPressing: {
    backgroundColor: colors2024['brand-light-1'],
  },
  walletIcon: {
    borderRadius: 12,
  },
}));

interface AddressItemProps {
  account: KeyringAccountWithAlias;
  alertCount?: number;
  approvalCount?: number;
  lastSelectedAccount?: KeyringAccountWithAlias;
  onSelect?: () => void;
}
export const AddressItemEntry = (props: AddressItemProps) => {
  const { account, onSelect, alertCount, approvalCount } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [isPressing, setIsPressing] = React.useState(false);
  const { t } = useTranslation();

  return (
    <AddressItemShadowView style={isPressing && styles.rootPressing}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        style={StyleSheet.flatten([styles.root])}
        delayLongPress={200} // long press delay
        onPress={onSelect}
        onLongPress={() => {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }}>
        <Card
          style={StyleSheet.flatten([
            styles.card,
            isPressing && styles.cardPressing,
          ])}>
          <InnerAddressItem style={styles.rootItem} account={account}>
            {({ WalletIcon, WalletName }) => (
              <View style={styles.item}>
                <WalletIcon
                  style={styles.walletIcon}
                  width={46}
                  height={46}
                  borderRadius={12}
                />
                <View style={styles.itemInfo}>
                  <View style={styles.itemName}>
                    <WalletName style={styles.itemNameText} />
                  </View>
                  {isNumber(approvalCount) ? (
                    <Text style={styles.approvalCount}>
                      {approvalCount || 0} {t('page.approvals.list.symbol')}
                    </Text>
                  ) : (
                    <Skeleton
                      circle
                      width={102}
                      height={20}
                      animation="wave"
                      LinearGradientComponent={LinearGradient}
                    />
                  )}
                </View>
              </View>
            )}
          </InnerAddressItem>

          <View style={styles.right}>
            {!!alertCount && alertCount > 0 && (
              <BadgeText count={alertCount} style={styles.badgeStyle} />
            )}
            <ArrowCircleCC
              style={styles.arrow}
              color={
                isPressing
                  ? colors2024['brand-default']
                  : colors2024['neutral-body']
              }
              backgroundColor={
                isPressing
                  ? colors2024['brand-light-1']
                  : colors2024['neutral-bg-2']
              }
            />
          </View>
        </Card>
      </TouchableOpacity>
    </AddressItemShadowView>
  );
};
