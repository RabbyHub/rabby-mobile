import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemo } from 'react';

const useCommonStyle = () => {
  const getStyle = useMemo(
    () =>
      createGetStyles2024(({ colors, colors2024 }) => {
        return {
          primaryText: {
            color: colors2024['neutral-title-1'],
            fontFamily: 'SF Pro Rounded',
            fontSize: 16,
            fontStyle: 'normal',
            fontWeight: '700',
            lineHeight: 20,
          },
          secondaryText: {
            color: colors2024['neutral-foot'],
            fontFamily: 'SF Pro Rounded',
            fontSize: 14,
            fontStyle: 'normal',
            fontWeight: '400',
            lineHeight: 18,
          },
          rowTitleText: {
            color: colors2024['neutral-title-1'],
            fontFamily: 'SF Pro Rounded',
            fontSize: 14,
            fontStyle: 'normal',
            fontWeight: '500',
            lineHeight: 18,
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
            color: colors2024['neutral-title-1'],
            fontFamily: 'SF Pro Rounded',
            fontSize: 14,
            fontStyle: 'normal',
            fontWeight: '500',
            lineHeight: 18,
          },
          subRowText: {
            color: colors2024['neutral-title-1'],
            fontFamily: 'SF Pro Rounded',
            fontSize: 16,
            fontStyle: 'normal',
            fontWeight: '700',
            lineHeight: 20,
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
            // textDecorationLine: 'underline',
            // textDecorationStyle: 'dashed',
          },
          row: {
            flexDirection: 'row',
          },
        };
      }),
    [],
  );
  const { styles } = useTheme2024({ getStyle });

  return styles;
};

export default useCommonStyle;
