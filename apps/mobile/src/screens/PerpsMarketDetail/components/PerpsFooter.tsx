/* eslint-disable react-native/no-inline-styles */
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { IS_ANDROID } from '@/core/native/utils';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from '@rneui/themed';
import { PerpsSkeletonGradient } from '@/screens/Perps/components/PerpsSkeletonLoader';

// Keep this override outside createGetStyles2024: its JSON normalization drops
// undefined, which would let Button restore its full-height lineHeight.
const naturalAndroidLineHeight = IS_ANDROID
  ? { lineHeight: undefined }
  : undefined;

export const PerpsFooter: React.FC<{
  onLongPress?(): void;
  onShortPress?(): void;
  onClosePress?(): void;
  onAddPress?(): void;
  hasPermission?: boolean;
  hasPosition?: boolean;
  /** Position state is not resolved yet; actions depend on it. */
  loading?: boolean;
  direction?: string;
}> = ({
  onLongPress,
  onShortPress,
  onClosePress,
  onAddPress,
  hasPermission,
  hasPosition,
  loading,
  direction,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const titleStyle = [styles.titleFontsize, naturalAndroidLineHeight];
  const footerStyle = [
    styles.footer,
    { paddingBottom: getBottomButtonBottomOffset(bottom) },
  ];

  if (loading) {
    return (
      <View style={footerStyle} testID="perps-footer-skeleton">
        {hasPermission ? (
          <View style={styles.btnGroup}>
            <View style={styles.btnContainer}>
              <Skeleton
                animation="wave"
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                LinearGradientComponent={PerpsSkeletonGradient}
                style={styles.skeleton}
              />
            </View>
            <View style={styles.btnContainer}>
              <Skeleton
                animation="wave"
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                LinearGradientComponent={PerpsSkeletonGradient}
                style={styles.skeleton}
              />
            </View>
          </View>
        ) : (
          <Skeleton
            animation="wave"
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            LinearGradientComponent={PerpsSkeletonGradient}
            style={styles.skeleton}
          />
        )}
      </View>
    );
  }
  if (hasPosition) {
    return (
      <View style={footerStyle}>
        {hasPermission ? (
          <View style={styles.btnGroup}>
            <View style={styles.btnContainer}>
              <Button
                type="hyperliquid-light"
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                title={t('page.perpsDetail.action.add', {
                  direction,
                })}
                titleStyle={titleStyle}
                onPress={onAddPress}
              />
            </View>
            <View style={styles.btnContainer}>
              <Button
                type="hyperliquid"
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                title={t('page.perpsDetail.action.close')}
                onPress={onClosePress}
                titleStyle={titleStyle}
              />
            </View>
          </View>
        ) : (
          <Button
            type="hyperliquid"
            title={t('page.perpsDetail.action.close')}
            onPress={onClosePress}
            titleStyle={[titleStyle, styles.singleTitle]}
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
              titleStyle={titleStyle}
              height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
              buttonStyle={{
                backgroundColor: colors2024['green-default'],
              }}
              title={t('page.perpsDetail.action.long')}
              onPress={onLongPress}
            />
          </View>
          <View style={styles.btnContainer}>
            <Button
              type="primary"
              titleStyle={titleStyle}
              height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
              buttonStyle={{
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
    ...(IS_ANDROID
      ? {
          // Center the natural glyph metrics inside Button's 1px border.
          // A full-button lineHeight plus font padding overflows this slot.
          height: BOTTOM_BUTTON_DOUBLE_HEIGHT - 2,
          paddingVertical: 0,
          includeFontPadding: false,
          textAlignVertical: 'center' as const,
        }
      : { lineHeight: BOTTOM_BUTTON_TEXT_LINE_HEIGHT }),
  },
  singleTitle: IS_ANDROID ? { height: BOTTOM_BUTTON_SINGLE_HEIGHT - 2 } : {},
  btnGroup: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: BOTTOM_BUTTON_GAP,
  },
  btnContainer: {
    flex: 1,
  },
  skeleton: {
    backgroundColor: 'rgba(190,190,190,0.2)',
    borderRadius: 12,
  },
  noPermissonBtn: {
    fontSize: 18,
    lineHeight: 22,
  },
}));
