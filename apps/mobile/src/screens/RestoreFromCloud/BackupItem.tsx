import { BackupStats } from '@/core/utils/cloudBackup';
import { createGetStyles } from '@/utils/styles';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useThemeStyles } from '@/hooks/theme';
import { RcIconCheckedFilledCC } from '@/assets/icons/common';
import dayjs from 'dayjs';
import React from 'react';
import { AddressAndCopy } from '@/components/Address/AddressAndCopy';
import { isNumber } from 'lodash';
import { formatUsdValue } from '@/utils/number';
import { getAccountBalance } from '@/components/HDSetting/util';
import { isAddress } from 'web3-utils';

const getStyles = createGetStyles(colors => ({
  root: {
    borderWidth: 1,
    borderColor: colors['neutral-line'],
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
  },
  rootSelected: {
    borderColor: colors['blue-default'],
  },
  body: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bodyTitle: {
    color: colors['neutral-title-1'],
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 20,
  },
  bodyDesc: {
    color: colors['neutral-foot'],
    fontSize: 12,
    marginTop: 6,
    lineHeight: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors['neutral-line'],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemBalance: {
    color: colors['neutral-body'],
    fontSize: 14,
  },
  itemAddress: {
    fontSize: 15,
  },
}));

interface BackupItemProps {
  item: BackupStats;
  index: number;
  onPress: () => void;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
}
export const BackupItem: React.FC<BackupItemProps> = ({
  item,
  selected,
  onPress,
  index,
  style,
}) => {
  const { styles } = useThemeStyles(getStyles);
  const [balance, setBalance] = React.useState<number>();
  const createdAtStr = React.useMemo(
    () => dayjs(item.createdAt).format('YYYY-MM-DD HH:mm'),
    [item.createdAt],
  );
  React.useEffect(() => {
    if (!isAddress(item.address)) {
      return;
    }
    getAccountBalance(item.address).then(setBalance);
  }, [item.address]);

  if (!isAddress(item.address)) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={StyleSheet.flatten([
        styles.root,
        selected && styles.rootSelected,
        style,
      ])}>
      <View style={styles.body}>
        <View>
          <Text style={styles.bodyTitle}>Seed Phrase {index + 1}</Text>
          <Text style={styles.bodyDesc}>Backup created on {createdAtStr}</Text>
        </View>
        {selected && <RcIconCheckedFilledCC width={24} height={24} />}
      </View>
      <View style={styles.footer}>
        <AddressAndCopy address={item.address} style={styles.itemAddress} />
        {isNumber(balance) && (
          <Text style={styles.itemBalance}>{formatUsdValue(balance)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};
