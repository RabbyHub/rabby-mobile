import React, { useEffect } from 'react';
import { Text, View } from 'react-native';

import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import useAsync from 'react-use/lib/useAsync';
import { openapi } from '@/core/request';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useDapps } from '@/hooks/useDapps';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { atom, useAtom } from 'jotai';

const hot3Atom = atom<DappInfo[]>([]);
const useHot3DApp = () => useAtom(hot3Atom);

export function BrowserHot({ onPress }: { onPress?(dapp: DappInfo): void }) {
  const { styles } = useTheme2024({
    getStyle,
  });
  const { dapps } = useDapps();
  const { bookmarkList } = useBrowserBookmark();

  const { value: hotDAppList } = useAsync(
    () => openapi.getHotDapps({ limit: 3, order_by: 'hot_count' } as any),
    [],
  );
  const [hot3, setHot3] = useHot3DApp();

  useEffect(() => {
    if (!hotDAppList?.length) {
      return;
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
      setHot3(list);
    });
  }, [hotDAppList, bookmarkList, dapps, setHot3]);

  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{t('page.browser.BrowserSearch.hot')}</Text>
      </View>
      <View style={styles.grid}>
        {hot3?.map(item => {
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
