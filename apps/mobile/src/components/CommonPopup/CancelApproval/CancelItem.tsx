import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Text } from '@/components/Typography';

export interface Props {
  onClick(): void;
  children: React.ReactNode;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: 16,
      paddingVertical: 15,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 6,
    },
    text: {
      fontSize: 14,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
  });

export const CancelItem: React.FC<Props> = ({ children, onClick }) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity onPress={onClick} style={styles.wrapper}>
      <Text style={styles.text}>{children}</Text>
      <RcIconArrowRight width={20} />
    </TouchableOpacity>
  );
};
