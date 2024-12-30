import React, { useRef } from 'react';
import { Keyboard, SafeAreaView, TouchableOpacity, View } from 'react-native';
import HeaderArea from '../Home/HeaderArea';
import { AssetContainer } from './components/AssetContainer';

import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { useCurrentAccount } from '@/hooks/account';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RcNextLeftCC } from '@/assets/icons/common';
import { NextSearchBar } from '@/components2024/SearchBar';
import { IS_IOS } from '@/core/native/utils';

function HomeScreen(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { triggerUpdate } = useTriggerHomeBalanceUpdate();
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });
  const inputRef = useRef<any>(null);

  // React.useEffect(() => {
  //   setNavigationOptions({
  //     // headerTitle: () => <HomeScreen.HeaderArea />,
  //   });
  // }, [currentAccount?.address, navigation, setNavigationOptions]);

  return (
    <NormalScreenContainer2024
      noHeader
      type="bg1"
      style={styles.rootScreenContainer}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
            Keyboard.dismiss();
          }}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} />
        </TouchableOpacity>
        <NextSearchBar
          style={styles.searchBar}
          placeholder={'Search'}
          value={''}
          onChangeText={() => {}}
          onFocus={() => {}}
          onBlur={() => {}}
          onCancel={() => {}}
          ref={inputRef}
        />
      </View>
      <SafeAreaView style={styles.safeView}>
        <AssetContainer onRefresh={triggerUpdate} />
      </SafeAreaView>
    </NormalScreenContainer2024>
  );
}

HomeScreen.HeaderArea = HeaderArea;

const getStyles = createGetStyles2024(() => ({
  rootScreenContainer: {
    paddingHorizontal: 16,
  },
  safeView: {
    flex: 1,
    paddingBottom: 56,
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 5,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  searchBar: {
    flex: 1,
  },
}));

export default HomeScreen;
