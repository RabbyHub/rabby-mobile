/* eslint-disable react-native/no-inline-styles */
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { bottom } = useSafeAreaInsets();
  const footerStyle = [
    styles.footer,
    { paddingBottom: getBottomButtonBottomOffset(bottom) },
  ];

  if (hasPosition) {
    return (
      <View style={footerStyle}>
        {hasPermission ? (
          <View style={styles.btnGroup}>
            <View style={styles.btnContainer}>
              <Button
                type="hyperliquid-light"
                buttonStyle={{ height: BOTTOM_BUTTON_DOUBLE_HEIGHT }}
                title={t('page.perpsDetail.action.add', {
                  direction,
                })}
                titleStyle={styles.titleFontsize}
                onPress={onAddPress}
              />
            </View>
            <View style={styles.btnContainer}>
              <Button
                type="hyperliquid"
                buttonStyle={{ height: BOTTOM_BUTTON_DOUBLE_HEIGHT }}
                title={t('page.perpsDetail.action.close')}
                onPress={onClosePress}
                titleStyle={styles.titleFontsize}
              />
            </View>
          </View>
        ) : (
          <Button
            type="hyperliquid"
            title={t('page.perpsDetail.action.close')}
            onPress={onClosePress}
            titleStyle={styles.titleFontsize}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          />
        )}
      </View>
    );
  }
  if (hasPermission) {
    return (
      <View style={footerStyle}>
        <View style={styles.btnGroup}>
          <View style={styles.btnContainer}>
            <Button
              type="primary"
              titleStyle={styles.titleFontsize}
              buttonStyle={{
                height: BOTTOM_BUTTON_DOUBLE_HEIGHT,
                backgroundColor: colors2024['green-default'],
              }}
              title={t('page.perpsDetail.action.long')}
              onPress={onLongPress}
            />
          </View>
          <View style={styles.btnContainer}>
            <Button
              type="primary"
              titleStyle={styles.titleFontsize}
              buttonStyle={{
                height: BOTTOM_BUTTON_DOUBLE_HEIGHT,
                backgroundColor: colors2024['red-default'],
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
    <View style={footerStyle}>
      <Button
        type="primary"
        title={t('page.perpsDetail.action.noPermission')}
        disabled
        titleStyle={styles.noPermissonBtn}
        height={BOTTOM_BUTTON_SINGLE_HEIGHT}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  footer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-1'],
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  titleFontsize: {
    fontSize: 18,
    lineHeight: 22,
  },
  btnGroup: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: BOTTOM_BUTTON_GAP,
  },
  btnContainer: {
    flex: 1,
  },
  noPermissonBtn: {
    fontSize: 18,
    lineHeight: 22,
  },
}));
