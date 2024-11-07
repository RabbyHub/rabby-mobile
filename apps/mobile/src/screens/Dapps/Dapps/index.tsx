import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';

import RcIconSearch from '@/assets/icons/dapp/icon-search.svg';
import HeaderTitleText from '@/components/ScreenHeader/HeaderTitleText';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { RootNames } from '@/constant/layout';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { useNavigation } from '@react-navigation/native';
import { Platform, StyleSheet, View } from 'react-native';
import { DappCardList } from './components/DappCardList';
// import { useRequest } from 'ahooks';
import { AppColorsVariants } from '@/constant/theme';
import { useDappsHome } from '@/hooks/useDappsHome';
import { DappsIOSScreen } from '../DappsIOS';
import {
  useActiveViewSheetModalRefs,
  useOpenDappView,
} from '../hooks/useDappView';
import { EmptyDapps } from './components/EmptyDapps';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { createGetStyles } from '@/utils/styles';

export const DappsScreen = () => {
  return <DappsIOSScreen />;
};
