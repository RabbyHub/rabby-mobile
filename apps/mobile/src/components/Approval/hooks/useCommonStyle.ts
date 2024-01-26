import { StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { useMemo } from 'react';

const useCommonStyle = () => {
  const colors = useThemeColors();
  const style = useMemo(() => {
    return StyleSheet.create({
      primaryText: {
        fontSize: 15,
        fontWeight: '500',
        lineHeight: 18,
        color: colors['neutral-title-1'],
      },
      secondaryText: {
        color: colors['neutral-body'],
        fontSize: 13,
        lineHeight: 15,
        fontWeight: '400',
      },
      rowTitleText: {
        fontSize: 15,
        lineHeight: 18,
        color: colors['neutral-title-1'],
      },
      rowFlexCenterItem: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      },
    });
  }, [colors]);

  return style;
};

export default useCommonStyle;
