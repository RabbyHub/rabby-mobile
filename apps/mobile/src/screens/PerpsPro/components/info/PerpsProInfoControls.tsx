import { PerpsProCheckboxIcon } from '../common/PerpsProCheckboxIcon';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

interface PerpsProInfoControlsProps {
  actionLabel: string;
  actionPending?: boolean;
  actionDisabled?: boolean;
  hideOtherSymbols: boolean;
  onAction?: () => void;
  onToggleHideOtherSymbols: () => void;
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
      testID,
    }) => {
      const { colors2024, styles } = useTheme2024({ getStyle });
      const { t } = useTranslation();

      return (
        <View style={styles.container} testID={testID}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  filterText: {
    color: colors2024['neutral-foot'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    height: 26,
    justifyContent: 'center',
    marginLeft: 'auto',
    minWidth: 64,
    paddingHorizontal: 8,
  },
  disabledAction: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    height: 26,
    justifyContent: 'center',
    marginLeft: 'auto',
    minWidth: 64,
    paddingHorizontal: 8,
  },
  actionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  disabledActionText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
