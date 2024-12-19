import React, { useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, View, ScrollView } from 'react-native';
import BigNumber from 'bignumber.js';
import { getCHAIN_ID_LIST } from '@/constant/projectLists';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { AssetAvatar, Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { useNavigationState } from '@react-navigation/native';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { ellipsisOverflowedText } from '@/utils/text';
import { createGetStyles2024 } from '@/utils/styles';
import { Button } from '@/components2024/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { navigate } from '@/utils/navigation';
import { MemoItem } from '../Home/components/ProtocolMoreItem';
import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { AbstractPortfolio, AbstractProject } from '../Home/types';
import { useMemoizedFn } from 'ahooks';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { resetNavigationTo } from '@/hooks/navigation';

export const DeFiDetailScreen = () => {
  const { styles, colors2024, colors } = useTheme2024({ getStyle });
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setNavigationOptions, navigation } = useSafeSetNavigationOptions();
  const { data, portfolioList } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.DeFiDetail)?.params,
  ) as {
    data: AbstractProject;
    portfolioList: AbstractPortfolio[];
  };

  const getHeaderTitle = useMemoizedFn(() => {
    return (
      <View style={styles.headerArea}>
        <AssetAvatar
          logo={data?.logo}
          logoStyle={styles.assetIcon}
          size={40}
          chain={data?.chain}
          chainSize={16}
        />
        <Text style={styles.tokenSymbol} numberOfLines={1} ellipsizeMode="tail">
          {/* {token?.name} */}
          {ellipsisOverflowedText(data?.name, 20)}
        </Text>
      </View>
    );
  });

  const navBack = useCallback(() => {
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else if (navigation) {
      resetNavigationTo(navigation, 'Home');
    }
  }, [navigation]);

  const getHeaderLeft = useMemoizedFn(() => {
    return (
      <CustomTouchableOpacity
        style={styles.backButtonStyle}
        hitSlop={24}
        onPress={navBack}>
        <RcIconHeaderBack
          width={24}
          height={24}
          color={colors2024['neutral-title-1']}
        />
      </CustomTouchableOpacity>
    );
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerLeft: getHeaderLeft,
    });
  }, [getHeaderTitle, setNavigationOptions, getHeaderLeft]);

  return (
    <NormalScreenContainer2024 type="bg1" overwriteStyle={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.projectHeaderNetWorth}>{data._netWorth}</Text>
        {portfolioList.map((item, index) => {
          return <MemoItem item={item} key={index} />;
        })}
      </ScrollView>
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  scrollContainer: {
    flex: 1,
    width: '100%',
    marginTop: 8,
    // backgroundColor: colors2024['neutral-bg-4'],
  },
  backButtonStyle: {
    // width: 56,
    // height: 56,
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -16,
    paddingLeft: 16,
  },
  projectHeaderNetWorth: {
    color: colors2024['neutral-title-1'],
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
    marginLeft: 25,
    marginBottom: 20,
  },
  headerArea: {
    width: '100%',
    height: 'auto',
    marginLeft: 8,
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  assetIcon: {
    borderRadius: 8,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  container: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
}));
