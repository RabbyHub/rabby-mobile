import React from 'react';
import { SafeAreaView } from 'react-native';
import HeaderArea from './HeaderArea';
import { AssetContainer } from './AssetContainer';

import { HomeTopArea } from './components/HomeTopArea';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { useCurrentAccount } from '@/hooks/account';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';

function HomeScreen(): JSX.Element {
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { triggerUpdate } = useTriggerHomeBalanceUpdate();
  const { currentAccount } = useCurrentAccount({
    disableAutoFetch: true,
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: () => <HomeScreen.HeaderArea />,
    });
  }, [currentAccount?.address, navigation, setNavigationOptions]);

  return (
    <NormalScreenContainer2024 type="bg1" style={styles.rootScreenContainer}>
      <SafeAreaView style={styles.safeView}>
        <AssetContainer
          renderHeader={() => <HomeTopArea />}
          onRefresh={triggerUpdate}
        />
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
    borderRadius: 24,
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
}));

export default HomeScreen;
