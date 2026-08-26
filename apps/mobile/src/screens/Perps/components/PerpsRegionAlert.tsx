import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { RcIconWarningCC } from '@/assets2024/icons/common';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';

export const PERPS_REGION_ALERT_DEFAULT_BOTTOM_SPACING = 12;
export const PERPS_REGION_ALERT_HEADER_SPACING = 8;
export const PERPS_REGION_ALERT_HORIZONTAL_MARGIN = 16;

export type PerpsRegionAlertLayout = {
  height: number;
  width: number;
};

export const PerpsRegionAlert: React.FC<{
  bottomSpacing?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  topSpacing?: number;
}> = ({
  bottomSpacing = PERPS_REGION_ALERT_DEFAULT_BOTTOM_SPACING,
  onLayout,
  topSpacing = 0,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        { marginBottom: bottomSpacing, marginTop: topSpacing },
      ]}
      testID="perps-region-alert">
      <RcIconWarningCC
        color={colors2024['orange-default']}
        height={18}
        style={styles.icon}
        width={18}
      />
      <Text style={styles.text}>{t('page.perps.regionNotSupport')}</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    backgroundColor: colors2024['orange-light-1'],
    borderRadius: 8,
    justifyContent: 'center',
    marginHorizontal: PERPS_REGION_ALERT_HORIZONTAL_MARGIN,
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    minWidth: 0,
    color: colors2024['orange-default'],
  },
}));
