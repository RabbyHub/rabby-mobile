import React from 'react';
import { View } from 'react-native';
import AuthButton from '@/components2024/AuthButton';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Account } from '@/types/account';
import { Tip } from '@/components';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';

export function ConvertDustBottomBar({
  disabled,
  onPress,
  safeOffBottom,
  status,
  isSupportedAccount,
}: {
  disabled?: boolean;
  safeOffBottom: number;
  onPress: () => void;
  status?: 'idle' | 'completed' | 'active' | 'paused';
  isSupportedAccount?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.bottomBar,
        {
          paddingBottom: getBottomButtonBottomOffset(safeOffBottom),
        },
      ]}>
      {!isSupportedAccount ? (
        <Tip content={t('page.convertDust.unsupportedAccount')}>
          <Button
            title={t('page.convertDust.bottomBar.start')}
            height={BOTTOM_BUTTON_SINGLE_HEIGHT}
            disabled
            containerStyle={styles.ctaContainer}
            buttonStyle={styles.ctaButton}
            titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
            onPress={onPress}
            noShadow
            type="primary"
          />
        </Tip>
      ) : status === 'active' ? (
        <Button
          title={t('page.convertDust.bottomBar.stop')}
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          disabled={disabled}
          containerStyle={styles.ctaContainer}
          buttonStyle={styles.ctaButton}
          titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
          onPress={onPress}
          noShadow
          type="danger"
        />
      ) : status === 'completed' ? (
        <Button
          title={t('global.Done')}
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          disabled={disabled}
          containerStyle={styles.ctaContainer}
          buttonStyle={styles.ctaButton}
          titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
          onPress={onPress}
          noShadow
          type="primary"
        />
      ) : status === 'paused' ? (
        <Button
          title={t('page.convertDust.bottomBar.continue')}
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          disabled={disabled}
          containerStyle={styles.ctaContainer}
          buttonStyle={styles.ctaButton}
          titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
          onPress={onPress}
          noShadow
          type="primary"
        />
      ) : (
        <AuthButton
          onFinished={onPress}
          title={t('page.convertDust.bottomBar.start')}
          authTitle={t('page.whitelist.confirmPassword')}
          disabled={disabled}
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
        />
      )}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  bottomBar: {
    flexShrink: 0,
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
    paddingHorizontal: 24,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  ctaContainer: {
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
  },
  ctaButton: {
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
    borderRadius: 12,
  },
}));
