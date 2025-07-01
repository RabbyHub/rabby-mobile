import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValueKMB } from '../../Home/utils/price';
import { useMemoizedFn } from 'ahooks';

interface TokenMetaInfoProps {
  tokenCreateAt: number;
  fdv?: number;
  containerStyle?: any;
}

export const TokenMetaInfo: React.FC<TokenMetaInfoProps> = ({
  tokenCreateAt,
  fdv,
  containerStyle,
}) => {
  const formatDistanceToNow = useMemoizedFn((time: number) => {
    const now = Date.now();
    const diffMs = now - time * 1000;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));

    if (hours < 24) {
      return `${hours}h`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d`;
    }
  });

  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  if (!tokenCreateAt && !fdv) {
    return null;
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {Boolean(tokenCreateAt) && (
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>
            {t('page.copyTrading.timeLabelAgo', {
              time: formatDistanceToNow(tokenCreateAt),
            })}
          </Text>
        </View>
      )}

      {Boolean(fdv) && (
        <View style={styles.fdvContainer}>
          <Text style={styles.fdvText}>
            {`FDV ${fdv ? formatUsdValueKMB(fdv) : '-'}`}
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeContainer: {
    backgroundColor: colors2024['blue-light-4'],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timeText: {
    color: colors2024['blue-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
  },
  fdvContainer: {
    backgroundColor: colors2024['green-light-4'],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fdvText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
  },
}));
