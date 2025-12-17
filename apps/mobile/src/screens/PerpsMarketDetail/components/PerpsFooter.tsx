import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AccountSummary } from '@/hooks/perps/usePerpsStore';

export const PerpsFooter: React.FC<{
  onLongPress?(): void;
  onShortPress?(): void;
  onClosePress?(): void;
  onAddPress?(): void;
  hasPermission?: boolean;
  hasPosition?: boolean;
  direction?: string;
}> = ({
  onLongPress,
  onShortPress,
  onClosePress,
  onAddPress,
  hasPermission,
  hasPosition,
  direction,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  if (hasPosition) {
    return (
      <View style={styles.footer}>
        {hasPermission ? (
          <View style={styles.btnGroup}>
            <View style={styles.btnContainer}>
              <Button
                type="ghost"
                buttonStyle={{
                  backgroundColor: colors2024['brand-light-1'],
                }}
                title={t('page.perpsDetail.action.add', {
                  direction,
                })}
                onPress={onAddPress}
              />
            </View>
            <View style={styles.btnContainer}>
              <Button
                type="primary"
                title={t('page.perpsDetail.action.close')}
                onPress={onClosePress}
              />
            </View>
          </View>
        ) : (
          <Button
            type="primary"
            title={t('page.perpsDetail.action.close')}
            onPress={onClosePress}
          />
        )}
      </View>
    );
  }
  if (hasPermission) {
    return (
      <View style={styles.footer}>
        <View style={styles.btnGroup}>
          <View style={styles.btnContainer}>
            <Button
              type="primary"
              buttonStyle={{
                backgroundColor: colors2024['green-light-1'],
              }}
              titleStyle={{
                color: colors2024['green-default'],
              }}
              title={t('page.perpsDetail.action.long')}
              onPress={onLongPress}
            />
          </View>
          <View style={styles.btnContainer}>
            <Button
              type="primary"
              buttonStyle={{
                backgroundColor: colors2024['red-light-1'],
              }}
              titleStyle={{
                color: colors2024['red-default'],
              }}
              title={t('page.perpsDetail.action.short')}
              onPress={onShortPress}
            />
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.footer}>
      <Button
        type="primary"
        title={t('page.perpsDetail.action.noPermission')}
        disabled
        titleStyle={styles.noPermissonBtn}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  footer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  btnGroup: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  btnContainer: {
    flex: 1,
  },
  noPermissonBtn: {
    fontSize: 14,
    lineHeight: 18,
  },
}));
