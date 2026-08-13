import React from 'react';
import { View } from 'react-native';

import { E2E_ID } from '@/constant/e2e';
import { HeaderBackPressable } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { ScreenStoreActivityProvider } from '@/hooks/storeActivity/ScreenStoreActivityProvider';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import { createGetStyles2024 } from '@/utils/styles';
import HomeHeaderArea from './HeaderArea';
import { SingleHomeRightArea } from './SingleHomeRightArea';

function SingleAddressHeaderContent() {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.container}>
      <View style={styles.containerLeft}>
        <HeaderBackPressable
          style={styles.backButton}
          {...makeTestIDProps(E2E_ID.home.singleAddressBack)}
        />
        <HomeHeaderArea />
      </View>
      <View style={styles.containerRight}>
        <SingleHomeRightArea />
      </View>
    </View>
  );
}

export function SingleAddressHeader() {
  return (
    <ScreenStoreActivityProvider label="single-address-header">
      <SingleAddressHeaderContent />
    </ScreenStoreActivityProvider>
  );
}

const getStyle = createGetStyles2024(({ safeAreaInsets }) => ({
  container: {
    marginTop: safeAreaInsets.top,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    width: '100%',
    zIndex: 10,
  },
  containerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    flexShrink: 1,
    marginRight: 20,
  },
  containerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  backButton: {
    marginRight: 4,
  },
}));
