import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { CheckBoxRect } from './CheckBox';
import { Text } from '@/components/Typography';

export interface Props {
  icon: React.ReactNode;
  title: string;
  balance?: string;
  badge?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export const SelectableAddressItem: React.FC<Props> = ({
  icon,
  title,
  balance,
  badge,
  selected,
  disabled,
  onPress,
}) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <View style={styles.itemInfo}>
        <View style={styles.itemName}>
          <Text
            style={styles.itemNameText}
            numberOfLines={1}
            ellipsizeMode="tail">
            {title}
          </Text>
          {badge}
        </View>
        {balance ? <Text style={styles.itemBalanceText}>{balance}</Text> : null}
      </View>
      <View style={disabled && styles.checkboxDisabled}>
        <CheckBoxRect checked={selected} />
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  item: {
    padding: 12,
    backgroundColor: colors2024['neutral-bg-0'],
    flexDirection: 'row',
    borderRadius: 12,
    alignItems: 'center',
  },
  checkboxDisabled: {
    marginLeft: 20,
    opacity: 0.5,
  },
  itemInfo: {
    marginLeft: 8,
    gap: 4,
    flex: 1,
  },
  itemName: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemNameText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    marginRight: 8,
    flexShrink: 1,
  },
  itemBalanceText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
}));
