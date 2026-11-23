import React, { useCallback } from 'react';
import { Keyboard, TouchableOpacity } from 'react-native';
import { useRoute } from '@react-navigation/native';

import { GetNestedScreenRouteProp } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { naviReplace } from '@/utils/navigation';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RcNextLeftCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';

import { PerpsSearchPanel } from './components/PerpsSearchPanel';

export const PerpsSearchScreen: React.FC = () => {
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'PerpsSearch'>
    >();
  const params = route.params || {};
  const { colors2024 } = useTheme2024();
  const navigation = useRabbyAppNavigation();

  const handleSelect = useCallback(
    (coin: string) => {
      const openFromSource = params.openFromSource;
      naviReplace(RootNames.StackTransaction, {
        screen: RootNames.PerpsMarketDetail,
        params: {
          market: coin,
          fromSource: openFromSource,
          showOpenPosition: openFromSource === 'openPosition',
          direction: params.direction ?? 'Long',
        },
      });
    },
    [params.direction, params.openFromSource],
  );

  const handleGoBack = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <PerpsSearchPanel
        autoFocus={params.autoFocus}
        initialTab={params.initialTab}
        leading={
          <TouchableOpacity hitSlop={12} onPress={handleGoBack}>
            <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
          </TouchableOpacity>
        }
        onSelect={handleSelect}
      />
    </NormalScreenContainer2024>
  );
};
