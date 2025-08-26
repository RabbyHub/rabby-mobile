/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PerpsAccountCard } from './components/PerpsAccountCard';
import { PerpsHeaderRight } from './components/PerpsHeaderRight';
import { PerpsHeaderTitle } from './components/PerpsHeaderTitle';
import { PerpsMain } from './components/PerpsMain';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import { PerpsAgentsLimitModal } from './components/PerpsAgentsLimitModal';
import { PerpsGuidePopup } from './components/PerpsGuidePopup';
import { PerpsDepositPopup } from './components/PerpsDepositPopup';
import { PerpsWithdrawPopup } from './components/PerpsWithdrawPopup';

export const PerpsScreen = () => {
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const { navigation } = useSafeSetNavigationOptions();

  useEffect(() => {
    navigation.setOptions({
      headerTitle: PerpsHeaderTitle,
      headerRight: PerpsHeaderRight,
    });
  }, [navigation]);

  return (
    <>
      <NormalScreenContainer2024 type="bg2">
        <View style={styles.container}>
          <PerpsMain ListHeaderComponent={<PerpsAccountCard />} />
        </View>
      </NormalScreenContainer2024>
      {/* todo */}
      <AccountSelectorPopup
        visible={false}
        onClose={() => {
          // setIsShowAccountPopup(false);
        }}
        // value={account}
        onChange={v => {}}
        isShowSafeAddressSection={false}
        isShowWatchAddressSection={false}
        title={t('page.perps.selectAccountTitle')}
      />
      <PerpsAgentsLimitModal visible={false} />
      <PerpsGuidePopup visible={false} />
      <PerpsDepositPopup visible={false} />
      <PerpsWithdrawPopup visible={true} />
    </>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
  },
}));
