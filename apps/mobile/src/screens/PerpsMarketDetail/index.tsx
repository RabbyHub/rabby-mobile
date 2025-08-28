/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { PerpsIntro } from './components/PerpsIntro';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
import { PerpsPosition } from './components/PerpsPosition';
import { PerpsInfo } from './components/PerpsInfo';
import { PerpsFooter } from './components/PerpsFooter';
import { PerpsOpenPositionPopup } from './components/PerpsOpenPositionPopup';
import { PerpsOpenPositionCheckPopup } from './components/PerpsOpenPositionCheckPopup';
import { PerpsClosePositionPopup } from './components/PerpsClosePositionPopup ';
import { PerpsAutoCloseModal } from './components/PerpsAutoCloseModal';
import { useRoute } from '@react-navigation/native';
import { GetNestedScreenNavigationProps } from '@/navigation-type';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { usePerpsState } from '@/hooks/perps/usePerpsState';
import { usePerpsStore } from '@/hooks/perps/usePerpsStore';

export const PerpsMarketDetailScreen = () => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();

  const route =
    useRoute<
      GetNestedScreenNavigationProps<
        'TransactionNavigatorParamList',
        'PerpsMarketDetail'
      >['route']
    >();

  const marketName = route.params.market;

  const { state } = usePerpsStore();
  const { positionAndOpenOrders, accountSummary, marketDataMap, perpFee } =
    state;

  const market = useMemo(() => {
    return marketDataMap[marketName.toUpperCase()];
  }, [marketDataMap, marketName]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <PerpsHeaderTitle market={market} />,
    });
  }, [market, navigation]);

  if (!market) {
    return null;
  }

  return (
    <>
      <NormalScreenContainer2024 type="bg2">
        <ScrollView
          style={styles.container}
          contentContainerStyle={{
            paddingBottom: 22,
          }}>
          <View style={styles.chart}></View>
          {/* <PerpsPosition /> */}
          <PerpsInfo market={market} />
          <PerpsIntro />
        </ScrollView>
        <PerpsFooter />
      </NormalScreenContainer2024>
      <PerpsOpenPositionPopup visible={false} />
      <PerpsOpenPositionCheckPopup visible={false} />
      <PerpsClosePositionPopup visible={false} />
      <PerpsAutoCloseModal visible={false} />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    position: 'relative',
  },
  chart: {
    backgroundColor: colors2024['neutral-bg-1'],
    height: 322,
    borderRadius: 20,
  },
}));
