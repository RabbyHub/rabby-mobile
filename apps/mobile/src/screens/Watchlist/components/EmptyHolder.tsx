import IconEmptyWatchlist from '@/assets2024/images/watchlist/empty-watchlist.png';
import IconEmptyWatchlistDark from '@/assets2024/images/watchlist/empty-watchlist-dark.png';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View, ViewProps, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

export const EmptyWatchlist = ({ style }: { style?: ViewProps['style'] }) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    <View style={[styles.container, style]}>
      <View style={styles.empty}>
        <Image
          source={isLight ? IconEmptyWatchlist : IconEmptyWatchlistDark}
          width={163}
          height={126}
          style={styles.img}
        />
        <View style={styles.emptyText}>
          <View style={styles.line} />
          <Text style={styles.title}>{t('page.watchlist.empty.title')}</Text>
          <View style={styles.line} />
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  img: {
    width: 163,
    height: 126,
  },
  container: {
    height: 186,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 17,
  },
  empty: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 21,
    alignItems: 'center',
  },
  title: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  desc: {
    color: colors['neutral-body'],
    fontSize: 14,
    lineHeight: 17,
  },
  image: {},
  line: {
    width: 40,
    height: 0,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  emptyText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 27,
  },
}));
