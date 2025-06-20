import { useTheme2024 } from '@/hooks/theme';
import OfflinePng from '@/assets2024/images/offline.png';
import OfflineDarkPng from '@/assets2024/images/offline-dark.png';
import { createGetStyles2024 } from '@/utils/styles';
import { View, Text, StyleProp, ViewStyle, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';

interface NetWorkErrorProps {
  hasError: boolean;
  style?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
}
export function NetWorkError({
  style,
  hasError,
  onRefresh,
}: NetWorkErrorProps) {
  const { styles, isLight } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();
  const preTypeRef = useRef<boolean>(false);

  useEffect(() => {
    if (!hasError && preTypeRef.current) {
      // auto refresh when network fine
      onRefresh?.();
    }
    preTypeRef.current = hasError;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError]);

  return (
    <View style={[styles.container, style]}>
      <Image
        style={styles.img}
        source={isLight ? OfflinePng : OfflineDarkPng}
      />
      <Text style={styles.title}>
        {t('component.globalWarning.offlineText')}
      </Text>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  img: {
    width: 163,
    height: 126,
  },
  title: {
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginTop: 21,
    marginBottom: 12,
  },
  btn: {
    width: 81,
    height: 28,
    borderRadius: 6,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
}));
