import {
  View,
  Text,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import RcServiceCC from '@/assets2024/icons/common/service-cc.svg';
import RcOfflineCC from '@/assets2024/icons/common/offline-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { refresh } from '@react-native-community/netinfo';
import { ErrorType } from '@/hooks/useGlobalStatus';

export enum GlobalWarningType {
  Network = 'network',
  Service = 'service',
}
interface GlobalWarningProps {
  errorType: ErrorType;
  description: string;
  style?: StyleProp<ViewStyle>;
  onRefresh?: () => void;
}
export function GlobalWarning({
  errorType,
  description,
  style,
  onRefresh,
}: GlobalWarningProps) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const type = useMemo(() => {
    if (errorType === 'network') {
      return GlobalWarningType.Network;
    }
    if (errorType === 'service') {
      return GlobalWarningType.Service;
    }
    return undefined;
  }, [errorType]);

  const isNetWorkError = useMemo(
    () => type === GlobalWarningType.Network,
    [type],
  );

  const title = useMemo(() => {
    return isNetWorkError
      ? t('component.globalWarning.serviceError.title')
      : t('component.globalWarning.networkError.title');
  }, [isNetWorkError, t]);

  const preTypeRef = useRef<GlobalWarningType | undefined>(undefined);
  useEffect(() => {
    if (!type && preTypeRef.current === GlobalWarningType.Network) {
      // auto refresh when network fine
      onRefresh?.();
    }
    preTypeRef.current = type;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (!type) {
    return null;
  }

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
          <TouchableOpacity
            hitSlop={20}
            style={styles.refreshButton}
            onPress={() => {
              if (isNetWorkError) {
                refresh();
              } else {
                onRefresh();
              }
            }}>
            <Text style={styles.refreshText}>
              {t('component.globalWarning.buttonText')}
            </Text>
          </TouchableOpacity>
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
