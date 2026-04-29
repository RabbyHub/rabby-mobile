import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import AuthButton from '@/components2024/AuthButton';
import { useTranslation } from 'react-i18next';

export function ConvertDustBottomBar({
  disabled,
  onPress,
  status,
}: {
  disabled?: boolean;
  safeOffBottom: number;
  onPress: () => void;
  status?: 'idle' | 'completed' | 'active' | 'paused';
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View pointerEvents="box-none" style={[styles.bottomBar]}>
      {status === 'active' ? (
        <Button
          title={'Stop'}
          height={52}
          disabled={disabled}
          containerStyle={styles.ctaContainer}
          buttonStyle={styles.ctaButton}
          titleStyle={styles.ctaTitle}
          onPress={onPress}
          noShadow
          type="danger"
        />
      ) : status === 'completed' ? (
        <Button
          title={'Done'}
          height={52}
          disabled={disabled}
          containerStyle={styles.ctaContainer}
          buttonStyle={styles.ctaButton}
          titleStyle={styles.ctaTitle}
          onPress={onPress}
          noShadow
          type="primary"
        />
      ) : status === 'paused' ? (
        <Button
          title={'Continue'}
          height={52}
          disabled={disabled}
          containerStyle={styles.ctaContainer}
          buttonStyle={styles.ctaButton}
          titleStyle={styles.ctaTitle}
          onPress={onPress}
          noShadow
          type="primary"
        />
      ) : (
        <AuthButton
          onFinished={onPress}
          title={'Start convert'}
          authTitle={t('page.whitelist.confirmPassword')}
          disabled={disabled}
          height={52}
        />
      )}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingTop: 12,
    paddingHorizontal: 24,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingBottom: 38,
  },
  ctaContainer: {
    height: 52,
  },
  ctaButton: {
    height: 52,
    borderRadius: 12,
  },
  ctaTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
