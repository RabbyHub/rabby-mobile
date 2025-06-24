import { View, Text, StyleProp, ViewStyle } from 'react-native';
import RcOfflineCC from '@/assets2024/icons/common/offline-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export enum GlobalWarningType {
  Network = 'network',
  Service = 'service',
}
interface GlobalWarningProps {
  hasError: boolean;
  description: string;
  style?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
}
export function GlobalWarning({
  hasError,
  description,
  style,
  onRefresh,
}: GlobalWarningProps) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const preTypeRef = useRef<boolean>(false);
  useEffect(() => {
    if (!hasError && preTypeRef.current) {
      // auto refresh when network fine
      onRefresh?.();
    }
    preTypeRef.current = hasError;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError]);

  if (!hasError) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <RcOfflineCC
        width={18}
        height={18}
        color={colors2024['neutral-title-1']}
      />
      <Text style={styles.content}>
        <Text style={styles.title}>
          {t('component.globalWarning.serviceError.title')}
        </Text>
        <Text style={styles.text}>{description} </Text>
        {!!onRefresh && (
          <Text onPress={onRefresh} style={styles.refreshText}>
            {t('component.globalWarning.buttonText')}
          </Text>
        )}
      </Text>
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: isLight
      ? 'rgba(224, 229, 236, 0.7)'
      : colors2024['neutral-bg-5'],
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
  },
  text: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
  },
  refreshText: {
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
  },
  refreshButton: {
    height: 13,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
}));
