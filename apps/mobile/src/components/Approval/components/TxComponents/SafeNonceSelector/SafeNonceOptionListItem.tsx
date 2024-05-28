import { RcIconCheckedFilledCC, RcIconUncheckCC } from '@/assets/icons/common';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface OptionListItemProps {
  children?: React.ReactNode;
  checked?: boolean;
  onPress?: () => void;
  isHideDivider?: boolean;
}

export const SafeNonceOptionListItem = ({
  children,
  checked,
  onPress,
  isHideDivider,
}: OptionListItemProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.nonceSelectOption, checked && styles.isChecked]}
      onPress={onPress}>
      <View style={styles.optionContent}>{children}</View>
      {checked ? (
        <RcIconCheckedFilledCC width={16} height={16} style={styles.icon} />
      ) : (
        <RcIconUncheckCC width={16} height={16} style={styles.icon} />
      )}
      {isHideDivider ? null : <View style={styles.divider} />}
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles(colors => ({
  nonceSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    color: colors['neutral-title-1'],
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    padding: 12,
    borderRadius: 6,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  divider: {
    position: 'absolute',
    bottom: -1,
    left: 12,
    right: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors['neutral-line'],
  },
  optionContent: {
    flexDirection: 'row',
  },
  isChecked: {
    borderColor: colors['blue-default'],
    backgroundColor: colors['blue-light-1'],
  },
  icon: {
    marginLeft: 'auto',
  },
}));
