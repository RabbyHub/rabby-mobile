/* eslint-disable react-native/no-inline-styles */
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RcIconMore } from '@/assets/icons/home';
import { useAddressDetailModal } from '../Address/useAddressDetailModal';
import RcIconHistory from '@/assets2024/singleHome/history.svg';
import { useTheme2024 } from '@/hooks/theme';
import { transactionHistoryService } from '@/core/services';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { View } from 'react-native';
import { AbstractPortfolioToken } from './types';
import { toast } from '@/components2024/Toast';
import { useTranslation } from 'react-i18next';
import { HomePendingBadge } from './components/HomePending';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useSingleHomeAccount, apisSingleHome } from './hooks/singleHome';
import RcIconSettingCC from '@/assets2024/icons/common/IconSetting.svg';
import { naviPush } from '@/utils/navigation';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

const historyHitSlop = {
  top: 4,
  bottom: 4,
  left: 4,
  right: 4,
};

interface HeaderRightHistoryProps {
  isInTokenDetail?: boolean;
  isMultiAddress?: boolean;
  tokenItem?: AbstractPortfolioToken;
}

const refreshHistoryIdState = zCreate<{ refreshId: number }>(() => ({
  refreshId: 0,
}));

export function setRefreshHistoryId(valOrFunc: UpdaterOrPartials<number>) {
  refreshHistoryIdState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.refreshId, valOrFunc, {
      strict: true,
    });
    return { refreshId: newVal };
  });
}

export function useRefreshHistoryId() {
  return {
    refreshHistoryId: refreshHistoryIdState(s => s.refreshId),
    setRefreshHistoryId,
  };
}

export const HeaderRightHistory: React.FC<HeaderRightHistoryProps> = ({
  isInTokenDetail,
  isMultiAddress,
  tokenItem,
}) => {
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const timeRef = useRef<null | ReturnType<typeof setInterval>>(null);
  const { navigation } = useSafeSetNavigationOptions();
  const { colors2024 } = useTheme2024();
  const [historyCount, setHistoryCount] = useState<{
    success: number;
    fail: number;
  }>();
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const { currentAccount } = useSingleHomeAccount();

  const fetchHistory = useCallback(() => {
    if (!currentAccount) {
      return;
    }

    const failCount = transactionHistoryService.getFailedCount(
      currentAccount.address,
    );
    const successCount = transactionHistoryService.getSucceedCount(
      currentAccount.address,
    );
    setHistoryCount({
      success: successCount,
      fail: failCount,
    });

    if (tokenItem) {
      // single token no pending tx
      return;
    }

    if (!currentAccount) {
      return;
    }
    const addresses = [currentAccount.address];
    const { pendingsLength } =
      transactionHistoryService.getPendingsAddresses(addresses);
    setPendingTxCount(pendingsLength);
    timeRef.current && clearInterval(timeRef.current);
    timeRef.current = pendingsLength ? setInterval(fetchHistory, 5000) : null;
  }, [currentAccount, tokenItem]);

  const refreshId = refreshHistoryIdState(s => s.refreshId);
  useEffect(() => {
    if (refreshId > 0) {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshId]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory]),
  );

  const openHistory = useCallback(async () => {
    apisSingleHome.setFoldChart(true);
    currentAccount &&
      (await switchSceneCurrentAccount('History', currentAccount));
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: isMultiAddress
          ? RootNames.MultiAddressHistory
          : RootNames.History,
        params: {
          isInTokenDetail,
          tokenItem,
          isMultiAddress,
          currentAddress: currentAccount?.address.toLowerCase(),
        },
      }),
    );
  }, [
    switchSceneCurrentAccount,
    currentAccount,
    navigation,
    isMultiAddress,
    isInTokenDetail,
    tokenItem,
  ]);

  return (
    <CustomTouchableOpacity hitSlop={historyHitSlop} onPress={openHistory}>
      {pendingTxCount > 0 ? (
        <View
          style={{ marginRight: 16, position: 'relative', paddingVertical: 4 }}>
          <HomePendingBadge number={pendingTxCount} />
        </View>
      ) : (
        <View
          style={{ marginRight: 16, position: 'relative', paddingVertical: 4 }}>
          <RcIconHistory
            color={colors2024['neutral-title-1']}
            width={22}
            height={22}
          />
          {Boolean(historyCount?.success || historyCount?.fail) && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  colors2024[
                    historyCount?.fail ? 'red-default' : 'green-default'
                  ],
                position: 'absolute',
                top: 0,
                right: -4,
              }}
            />
          )}
        </View>
      )}
    </CustomTouchableOpacity>
  );
};

export const SingleHomeRightArea = () => {
  const { navigation } = useSafeSetNavigationOptions();
  const { colors2024 } = useTheme2024();
  const { t } = useTranslation();

  const { currentAccount } = useSingleHomeAccount();

  const onPress = () => {
    if (currentAccount) {
      apisSingleHome.setFoldChart(true);

      naviPush(RootNames.StackAddress, {
        screen: RootNames.AddressDetail,
        params: {
          address: currentAccount.address,
          type: currentAccount.type,
          brandName: currentAccount.brandName,
        },
      });
    }
  };

  return (
    <>
      <HeaderRightHistory />
      <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
        <RcIconSettingCC
          width={20}
          height={20}
          color={colors2024['neutral-title-1']}
        />
      </CustomTouchableOpacity>
    </>
  );
};
