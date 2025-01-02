import React, { useRef } from 'react';
import { Keyboard, SafeAreaView, TouchableOpacity, View } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RcNextLeftCC } from '@/assets/icons/common';
import { NextSearchBar } from '@/components2024/SearchBar';

import { SearchAssets } from './components/SearchAssets';

function SearchScreen(): JSX.Element {
  const { navigation } = useSafeSetNavigationOptions();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const inputRef = useRef<any>(null);

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
        <SearchAssets />
      </SafeAreaView>
    </NormalScreenContainer2024>
  );
}

const getStyles = createGetStyles2024(() => ({
  rootScreenContainer: {},
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

export default SearchScreen;
