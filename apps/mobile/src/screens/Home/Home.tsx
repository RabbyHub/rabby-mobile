import React from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { AssetContainer } from './AssetContainer';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { BottomBtns } from './components/BottomBtns';
import {
  HomeBackgroundOpacityProvider,
  TopBg,
} from './components/BgComponents';
import { useBgSize } from './hooks/useBgSize';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import {
  apisSingleHome,
  useSingleHomeAccount,
  useSingleHomeIsDecrease,
  useSingleHomeLoading,
} from './hooks/singleHome';
import { useUnmount } from 'ahooks';
import { HomeTopArea } from './components/HomeTopArea';
import { BackupReminderCard } from '@/components2024/BackupReminderCard';
import { useBackupReminder } from '@/hooks/account';
import { useFocusEffect } from '@react-navigation/native';
import { apisAddressBalance } from '@/hooks/useCurrentBalance';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';
import {
  ensureFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';
import { useFeatureActivationDiagnostics } from '@/hooks/useFeatureActivationDiagnostics';
import { ScreenStoreActivityProvider } from '@/hooks/storeActivity/ScreenStoreActivityProvider';

function SingleAddressActivationProbe({
  currentAddress,
}: {
  currentAddress: string;
}) {
  useFeatureActivationDiagnostics('single-address');
  const { balanceLoading, isLoadingCurve } = useSingleHomeLoading();

  React.useEffect(() => {
    if (balanceLoading || isLoadingCurve) {
      return;
    }

    const cycleId = ensureFeatureActivation(
      'single-address',
      'single_address_data_probe',
    );
    markFeatureActivation('single-address', 'data-ready', {
      cycleId,
      reason: 'balance_and_curve_settled',
      detail: `address=*${currentAddress.slice(-4)}`,
    });
  }, [balanceLoading, currentAddress, isLoadingCurve]);

  return null;
}

function SingleAddressHomeContent(): JSX.Element {
  const activationCycleId = ensureFeatureActivation(
    'single-address',
    'single_address_content_render_fallback',
  );
  markFeatureActivation('single-address', 'content-render-start', {
    cycleId: activationCycleId,
    reason: 'single_address_home_content_render',
  });
  const { styles } = useTheme2024({ getStyle: getStyles });
  const backgroundOpacity = useSharedValue(1);
  const { topHeight } = useBgSize();
  const { currentAccount } = useSingleHomeAccount();
  const currentAddress = currentAccount?.address;
  const hasFocusedOnceRef = React.useRef(false);
  const needsBackupReminder = useBackupReminder(currentAccount);

  const { isDecrease } = useSingleHomeIsDecrease();

  useRendererDetect({ name: 'SingleAddressHome' });

  useFocusEffect(
    React.useCallback(() => {
      if (!currentAddress) {
        return;
      }

      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }

      apisAddressBalance.triggerUpdate({
        address: currentAddress,
        fromScene: 'SingleAddressHome',
      });
    }, [currentAddress]),
  );

  const handleTouchEnd = () => {
    apisSingleHome.setFoldChart(true);
  };

  useUnmount(() => {
    apisSingleHome.clearCurrentAccount();
  });

  return (
    <HomeBackgroundOpacityProvider value={backgroundOpacity}>
      <NormalScreenContainer2024
        type="bg1"
        overwriteStyle={[
          styles.rootScreenContainer,
          {
            // 设计要求，TODO: check一些安卓机型
            paddingTop: topHeight,
          },
        ]}>
        {isNonProductionDiagnosticsEnabled && currentAddress ? (
          <SingleAddressActivationProbe currentAddress={currentAddress} />
        ) : null}
        <TopBg isDecrease={isDecrease} />

        <View style={styles.safeView} onTouchStart={handleTouchEnd}>
          <HomeTopArea />
          <BackupReminderCard
            visible={needsBackupReminder}
            account={currentAccount}
          />
          <AssetContainer />
        </View>
        <View style={styles.bottomContainer} onTouchStart={handleTouchEnd}>
          <BottomBtns currentAccount={currentAccount} />
        </View>
      </NormalScreenContainer2024>
    </HomeBackgroundOpacityProvider>
  );
}

function SingleAddressHome(): JSX.Element {
  return (
    <ScreenStoreActivityProvider label="single-address">
      <SingleAddressHomeContent />
    </ScreenStoreActivityProvider>
  );
}

const getStyles = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  rootScreenContainer: {
    // paddingHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-gray'],
  },
  bottomContainer: {
    width: '100%',
    height:
      BOTTOM_BUTTON_TOP_OFFSET +
      BOTTOM_BUTTON_DOUBLE_HEIGHT +
      getBottomButtonBottomOffset(safeAreaInsets.bottom),
    backgroundColor: colors2024['neutral-bg-1'],
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  safeView: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
}));

export default SingleAddressHome;
