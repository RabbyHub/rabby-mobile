import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { noop } from 'lodash';
import React from 'react';
import { isAddress } from 'web3-utils';
import dayjs from 'dayjs';
import { Skeleton } from '@rneui/themed';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { RcIconCheckedFilledCC } from '@/assets/icons/common';
import { BackupData } from '@/core/utils/cloudBackup';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Card } from '@/components2024/Card';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { getAccountBalance } from '@/components/HDSetting/util';
import { ellipsisAddress } from '@/utils/address';
import { CheckBoxRect } from '@/components2024/CheckBox';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  rootImported: {
    opacity: 0.5,
    borderColor: 'transparent',
  },
  body: {
    paddingVertical: 21,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  time: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
  bodyTitle: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },
  bodyDesc: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    marginTop: 6,
    lineHeight: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors2024['neutral-line'],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemBalance: {
    color: colors2024['neutral-body'],
    fontSize: 14,
  },
  itemAddress: {
    fontSize: 15,
  },
  checkBox: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    width: '100%',
  },
  importedText: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    marginLeft: 6,
  },
  imported: {
    flexDirection: 'row',
  },
  addressItemWrapper: {
    flex: 1,
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
    marginRight: 20,
  },
  walletIcon: {
    borderRadius: 12,
  },
  item: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
    width: '100%',
  },
  itemInfo: {
    gap: 6,
    flexGrow: 1,
    flex: 1,
  },
  itemNameText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  itemBalanceText: {
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
    fontWeight: '500',
  },
  itemName: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
}));

interface BackupItemProps {
  item: BackupData;
  index: number;
  onPress: () => void;
  selected: boolean;
  imported: boolean;
  style?: StyleProp<ViewStyle>;
}
export const BackupItem: React.FC<BackupItemProps> = ({
  item,
  selected,
  imported,
  onPress,
  index,
  style,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const [balance, setBalance] = React.useState<number>();
  const createdAtStr = React.useMemo(
    () => dayjs(Number(item.createdAt)).format('YYYY/MM/DD HH:mm'),
    [item.createdAt],
  );

  React.useEffect(() => {
    if (!isAddress(item.address)) {
      return;
    }
    getAccountBalance(item.address, true).then(setBalance);
  }, [item.address]);

  if (!isAddress(item.address)) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={imported ? noop : onPress}
      style={StyleSheet.flatten([imported && styles.rootImported, style])}>
      <Card style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.bodyTitle}>Seed Phrase {index + 1}</Text>
          <Text style={styles.time}>{createdAtStr}</Text>
        </View>
        <View style={styles.checkBox}>
          {imported ? (
            <View style={styles.imported}>
              <RcIconCheckedFilledCC width={16} height={16} />
            </View>
          ) : (
            <CheckBoxRect checked={selected} />
          )}
          <View style={styles.addressItemWrapper}>
            <AddressItem
              style={styles.rootItem}
              account={{
                brandName: KEYRING_CLASS.MNEMONIC,
                aliasName: ellipsisAddress(item.address),
                address: item.address,
                balance,
                type: KEYRING_CLASS.MNEMONIC,
              }}>
              {({ WalletIcon, WalletName, WalletBalance }) => (
                <View style={styles.item}>
                  <WalletIcon
                    style={styles.walletIcon}
                    width={40}
                    height={40}
                  />
                  <View style={styles.itemInfo}>
                    <View style={styles.itemName}>
                      <WalletName style={styles.itemNameText} />
                    </View>
                    <WalletBalance style={styles.itemBalanceText} />
                  </View>
                </View>
              )}
            </AddressItem>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

export const BackupItemSkeleton = () => {
  const { styles } = useTheme2024({ getStyle: getSkeletonStyle });

  return (
    <Card style={styles.card}>
      <Skeleton
        height={29}
        animation="wave"
        circle
        skeletonStyle={styles.header}
        LinearGradientComponent={LinearGradient}
      />
      <View style={styles.main}>
        <Skeleton
          circle
          LinearGradientComponent={LinearGradient}
          animation="wave"
          width={47}
          height={47}
        />
        <View style={styles.section}>
          <Skeleton
            LinearGradientComponent={LinearGradient}
            animation="wave"
            circle
            height={19}
          />
          <Skeleton
            LinearGradientComponent={LinearGradient}
            animation="wave"
            circle
            height={19}
          />
        </View>
      </View>
    </Card>
  );
};

const getSkeletonStyle = createGetStyles2024(ctx => ({
  card: {
    marginBottom: 12,
    display: 'flex',
  },
  header: {
    width: '100%',
    height: 29,
  },
  main: {
    marginTop: 24,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  section: {
    flex: 1,
    display: 'flex',
    gap: 4,
  },
}));
