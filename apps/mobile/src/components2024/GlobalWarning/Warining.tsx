import { View, Text, StyleProp, ViewStyle } from 'react-native';
import RcServiceCC from '@/assets2024/icons/common/service-cc.svg';
import RcOfflineCC from '@/assets2024/icons/common/offline-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export enum GlobalWarningType {
  Network = 'network',
  Service = 'service',
}
interface GlobalWarningProps {
  type: GlobalWarningType;
  description: string;
  style?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
}
export function GlobalWarning({
  type = GlobalWarningType.Network,
  description,
  style,
  onRefresh,
}: GlobalWarningProps) {
  const { t } = useTranslation();
  const isNetWorkError = type === GlobalWarningType.Network;
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const title = useMemo(() => {
    return isNetWorkError
      ? t('component.globalWarning.serviceError.title')
      : t('component.globalWarning.networkError.title');
  }, [isNetWorkError, t]);

  return (
    <View style={[styles.container, style]}>
      {isNetWorkError ? (
        <RcOfflineCC
          width={18}
          height={18}
          color={colors2024['neutral-title-1']}
        />
      ) : (
        <RcServiceCC
          width={18}
          height={18}
          color={colors2024['neutral-title-1']}
        />
      )}
      <Text style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{description}</Text>
        {onRefresh && (
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
}));
