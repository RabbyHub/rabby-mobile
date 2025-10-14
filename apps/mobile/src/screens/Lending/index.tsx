import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  RefreshControl,
  Platform,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTranslation } from 'react-i18next';

const isAndroid = Platform.OS === 'android';

function DashBoardScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      noHeader
      overwriteStyle={styles.overwriteStyle}>
      <View style={styles.header} />
      <View>
        <Text>Lending</Text>
      </View>
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  overwriteStyle: {
    position: 'relative',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  header: {
    height: isAndroid ? 46 : 44,
  },
}));

export default DashBoardScreen;
