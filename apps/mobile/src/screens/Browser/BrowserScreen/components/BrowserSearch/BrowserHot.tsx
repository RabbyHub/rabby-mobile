import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { openapi } from '@/core/request';
import { DappInfo } from '@/core/services/dappService';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTheme2024 } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { createGetStyles2024 } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';

export function BrowserHot({ onPress }: { onPress?(dapp: DappInfo): void }) {
  const { styles } = useTheme2024({
    getStyle,
  });
  const { dapps } = useDapps();
  const { bookmarkList } = useBrowserBookmark();

  const { data: hotDAppList = [] } = useRequest(
    () => openapi.getHotDapps({ limit: 10, order_by: 'hot_count' }),
    {
      cacheKey: 'hot-dapps',

      staleTime: 1000 * 60 * 10, // 10 minutes
    },
  );

  const hotList = useMemo(() => {
    if (!hotDAppList?.length) {
      return [];
    }
    const list: DappInfo[] = [];

    (hotDAppList || []).forEach(info => {
      const origin = stringUtils.ensurePrefix(info.id, 'https://');
      const local = dapps[origin];

      const dappInfo = {
        ...local,
        name: info?.name || local?.name,
        icon: local?.icon || info?.logo_url,
        origin,
        info,
        isFavorite: !!bookmarkList.find(
          item => safeGetOrigin(item.origin || item.url || '') === origin,
        ),
        isDapp: true,
      } as DappInfo;

      list.push(dappInfo);
    });

    return list;
  }, [bookmarkList, dapps, hotDAppList]);

  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('page.browser.BrowserSearch.hot10')}
        </Text>
      </View>
      <View style={styles.grid}>
        {hotList?.map(item => {
          return (
            <BrowserSiteCard data={item} onPress={onPress} key={item.origin} />
          );
        })}
      </View>
    </View>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: {
    paddingHorizontal: 20,
  },
  header: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
  grid: {
    gap: 8,
  },
}));
