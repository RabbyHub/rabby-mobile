import React from 'react';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { createGetStyles2024 } from '@/utils/styles';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useMemoizedFn } from 'ahooks';
import { DappCardList } from '../components/DappCardList';
import { useOpenDappView } from '../hooks/useDappView';
import { Text } from 'react-native';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import LinearGradient from 'react-native-linear-gradient';

export function FavoriteDappsScreen(): JSX.Element {
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const { favoriteApps } = useDappsHome();

  const title = `Favorites（${favoriteApps.length}）`;

  const getHeaderTitle = useMemoizedFn(() => {
    return <Text style={styles.title}>{title}</Text>;
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      title,
    });
  }, [setNavigationOptions, getHeaderTitle, title]);

  const { setBrowserHistory, updateFavorite } = useDappsHome();
  const { openUrlAsDapp } = useOpenDappView();

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });

  type OpenUrlAsDappOptions = Pick<
    Parameters<typeof openUrlAsDapp>[1] & object,
    'useLatestWebViewId'
  >;
  const handleOpenURL = useMemoizedFn(
    (url: string, options?: OpenUrlAsDappOptions) => {
      openUrlAsDapp(url, {
        useLatestWebViewId: true,
        ...options,
        showSheetModalFirst: true,
      });
      setBrowserHistory(safeGetOrigin(url));
    },
  );

  const handleFavoriteDapp = useMemoizedFn((dapp: DappInfo) => {
    updateFavorite(dapp.origin, !dapp.isFavorite);
  });

  return (
    <LinearGradient
      colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
      start={{ x: 0, y: 0.0728 }}
      end={{ x: 0, y: 0.1614 }}>
      <NormalScreenContainer overwriteStyle={styles.page}>
        <DappCardList
          data={favoriteApps}
          onFavoritePress={handleFavoriteDapp}
          onPress={dapp => {
            handleOpenURL(dapp.origin);
          }}
        />
      </NormalScreenContainer>
    </LinearGradient>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  page: {
    // backgroundColor: 'red',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
}));
