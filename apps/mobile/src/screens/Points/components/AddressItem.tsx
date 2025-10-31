import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { Card } from '@/components2024/Card';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { Skeleton } from '@rneui/themed';
import { AccountPoints } from '../hooks';
import RcIconPointsCC from '@/assets2024/icons/home/IconPointsCC.svg';
import { formatTokenAmount } from '@/utils/number';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    flexGrow: 1,
    padding: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],

    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
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
    gap: 0,
    flexGrow: 1,
    flex: 1,
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  pointsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 28,
  },
  points: {
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
  claimBox: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors2024['brand-light-1'],
  },
  claimText: {
    color: colors2024['brand-disable'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
}));

interface AddressItemProps {
  account: AccountPoints;
}
export const AddressPointItem = (props: AddressItemProps) => {
  const { account } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const isLoading = account.claimed_points === undefined;

  return (
    <Card style={StyleSheet.flatten([styles.card])}>
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
              <WalletName style={styles.itemNameText} />
              {!isLoading ? (
                <View style={styles.pointsBox}>
                  <RcIconPointsCC
                    width={20}
                    height={20}
                    color={colors2024['brand-default-icon']}
                  />
                  <Text style={styles.points}>
                    {t('page.rabbyPoints.alreadyClaimedXPoints', {
                      point: formatTokenAmount(account.claimed_points || 0, 0),
                    })}
                  </Text>
                </View>
              ) : (
                <View style={styles.pointsBox}>
                  <Skeleton
                    circle
                    width={102}
                    height={20}
                    animation="wave"
                    LinearGradientComponent={LinearGradient}
                  />
                </View>
              )}
            </View>
          </View>
        )}
      </InnerAddressItem>

      <View style={styles.right}>
        {/* <View style={styles.claimBox}>
          <Text style={styles.claimText}>
            {t('page.rabbyPoints.claimItem.claim')}
          </Text>
        </View> */}
      </View>
    </Card>
  );
};
