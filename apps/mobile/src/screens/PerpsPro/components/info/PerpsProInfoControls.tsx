import { PerpsProCheckboxIcon } from '../common/PerpsProCheckboxIcon';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  PERPS_PRO_INFO_CONTROLS_ROW_HEIGHT,
  PERPS_PRO_POSITIONS_CONTROLS_HEIGHT,
  PERPS_PRO_POSITIONS_CONTROLS_INSET,
} from './perpsProInfoTabsSticky';

interface PerpsProInfoControlsProps {
  actionLabel: string;
  actionPending?: boolean;
  actionDisabled?: boolean;
  hideOtherSymbols: boolean;
  onAction?: () => void;
  onToggleHideOtherSymbols: () => void;
  style?: StyleProp<ViewStyle>;
  testID: string;
}

export const PerpsProInfoControls: React.FC<PerpsProInfoControlsProps> =
  React.memo(
    ({
      actionLabel,
      actionDisabled = true,
      actionPending = false,
      hideOtherSymbols,
      onAction,
      onToggleHideOtherSymbols,
      style,
      testID,
    }) => {
      const { colors2024, styles } = useTheme2024({ getStyle });
      const { t } = useTranslation();

      return (
        <View style={[styles.container, style]} testID={testID}>
          <Pressable
            accessibilityLabel={t('page.perps.pro.info.hideOtherSymbols')}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: hideOtherSymbols }}
            onPress={onToggleHideOtherSymbols}
            style={styles.filter}>
            <PerpsProCheckboxIcon
              checked={hideOtherSymbols}
              checkColor={colors2024['neutral-InvertHighlight']}
              testID="perps-pro-info-filter-checkbox-icon"
            />
            <Text numberOfLines={1} style={styles.filterText}>
              {t('page.perps.pro.info.hideOtherSymbols')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              busy: actionPending,
              disabled: actionDisabled || actionPending,
            }}
            disabled={actionDisabled || actionPending}
            onPress={onAction}
            style={
              actionDisabled || actionPending
                ? styles.disabledAction
                : styles.action
            }>
            <Text
              style={
                actionDisabled || actionPending
                  ? styles.disabledActionText
                  : styles.actionText
              }>
              {actionLabel}
            </Text>
          </Pressable>
        </View>
      );
    },
  );

PerpsProInfoControls.displayName = 'PerpsProInfoControls';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: PERPS_PRO_POSITIONS_CONTROLS_HEIGHT,
    // Figma 86609:330024: 12pt list inset + 8pt row inset.
    paddingHorizontal: 20,
    paddingVertical: PERPS_PRO_POSITIONS_CONTROLS_INSET,
  },
  filter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  filterText: {
    color: colors2024['neutral-secondary'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    borderCurve: 'continuous',
    height: PERPS_PRO_INFO_CONTROLS_ROW_HEIGHT,
    justifyContent: 'center',
    marginLeft: 'auto',
    minWidth: 64,
    paddingHorizontal: 8,
  },
  disabledAction: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    borderCurve: 'continuous',
    height: PERPS_PRO_INFO_CONTROLS_ROW_HEIGHT,
    justifyContent: 'center',
    marginLeft: 'auto',
    minWidth: 64,
    paddingHorizontal: 8,
  },
  actionText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  disabledActionText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
}));
