import { StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { useMemo } from 'react';

const useCommonStyle = () => {
  const colors = useThemeColors();
  const style = useMemo(() => {
    return StyleSheet.create({
      primaryText: {
        fontSize: 14,
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
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '400',
        color: colors['neutral-title-1'],
      },
      detailRowTitleText: {
        color: colors['neutral-body'],
        fontSize: 14,
        lineHeight: 17,
      },
      detailPrimaryText: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 17,
        color: colors['neutral-title-1'],
      },
      subRowTitleText: {
        fontSize: 14,
        lineHeight: 17,
        fontWeight: '400',
        color: colors['neutral-body'],
      },
      subRowText: {
        fontSize: 14,
        lineHeight: 17,
        fontWeight: '500',
        color: colors['neutral-title-1'],
      },
      subRowNestedText: {
        fontSize: 14,
        lineHeight: 17,
        color: colors['neutral-foot'],
      },
      rowFlexCenterItem: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      },
      clickableTokenText: {
        textDecorationLine: 'underline',
        textDecorationStyle: 'dashed',
      },
    });
  }, [colors]);

  return style;
};

export default useCommonStyle;
