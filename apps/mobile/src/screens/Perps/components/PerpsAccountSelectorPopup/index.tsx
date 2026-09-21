import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useAccountSelectorList } from '@/components2024/AccountSelector/useAccountSelectorList';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { apisPerps } from '@/core/apis';
import type { Account } from '@/core/startupServices/preference';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import { useAccounts, usePinAddresses } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMemoizedFn, useRequest } from 'ahooks';
import { uniqBy } from 'lodash';
import PQueue from 'p-queue';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { PerpsAccountSelectorItem } from './PerpsAccountSelectorItem';
import {
  getClearinghouseStateByMap,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import {
  fetchPerpsPortfolio,
  perpsPortfolioStore,
} from '@/hooks/perps/usePerpsPortfolioStore';
import { getLatestPortfolioValue } from '@/hooks/perps/perpsPortfolio';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { Text } from '@/components/Typography';
import { useEnablePerpsWatchAddress } from '@/hooks/appSettings';
import {
  buildPerpsAccountSelectorData,
  enqueuePortfolioFetches,
  PERPS_SELECTOR_PORTFOLIO_CONCURRENCY,
  PERPS_SELECTOR_PORTFOLIO_MAX_AGE_MS,
  type PerpsAccountInfoByAddress,
  type PerpsPortfolioValueByAddress,
} from './accountSelectorData';

// Module-level on purpose: reopening the popup reuses the same queue, and the
// portfolio store's in-flight/freshness dedup turns re-enqueued addresses
// into immediate no-ops.
const portfolioFetchQueue = new PQueue({
  concurrency: PERPS_SELECTOR_PORTFOLIO_CONCURRENCY,
});

export const PerpsAccountSelectorPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  value?: Account | null;
  onChange?: (a: Account) => void;
  title?: React.ReactNode;
  checkIconPosition?: 'name' | 'right';
}> = ({
  visible,
  onClose,
  value,
  onChange,
  title,
  checkIconPosition = 'name',
}) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getModalStyle,
  });

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const { data: lastUsedAccount, runAsync: runGetLastUsedAccount } = useRequest(
    () => {
      return apisPerps.getPerpsLastUsedAccount();
    },
    {
      manual: true,
    },
  );

  const { fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const { getPinAddressesAsync } = usePinAddresses({
    disableAutoFetch: true,
  });
  const { myAddresses, watchAddresses } = useAccountSelectorList({
    selectedAccount: value,
  });

  const { enablePerpsWatchAddress } = useEnablePerpsWatchAddress();

  const addresses = useMemo(
    () =>
      enablePerpsWatchAddress
        ? [...myAddresses, ...watchAddresses]
        : myAddresses,
    [enablePerpsWatchAddress, myAddresses, watchAddresses],
  );

  const fetchTargets = useMemo(
    () => uniqBy(addresses, i => i.address.toLowerCase()).slice(0, 10),
    [addresses],
  );

  // Position count + list ordering come from the in-memory clearinghouse map
  // only — a sync snapshot taken when the popup opens. The per-row USD value
  // is the portfolio store's job now (queued below, rendered by the item).
  const perpsInfoByAddress = useMemo(() => {
    if (!visible) {
      return undefined;
    }
    return fetchTargets.reduce<PerpsAccountInfoByAddress>((result, item) => {
      result[item.address.toLowerCase()] =
        getClearinghouseStateByMap(item.address) ?? null;
      return result;
    }, {});
  }, [fetchTargets, visible]);

  // Sorting reads the PV cache once per open (frozen while open — see
  // buildPerpsAccountSelectorData). Row display stays live via each row's own
  // store subscription; a reopen within the 5-min window has the full cache
  // and sorts by PV exactly.
  const portfolioValueByAddress = useMemo(() => {
    if (!visible) {
      return undefined;
    }
    const map = perpsPortfolioStore.getState().portfolioMap;
    return fetchTargets.reduce<PerpsPortfolioValueByAddress>((result, item) => {
      const entry = map[item.address.toLowerCase()];
      result[item.address.toLowerCase()] = entry?.data
        ? getLatestPortfolioValue(entry.data)
        : null;
      return result;
    }, {});
  }, [fetchTargets, visible]);

  // One portfolio fetch per row (Portfolio Value, same basis as the account
  // card). The queue drips the opening burst — richest wallet first — and the
  // 5-min freshness window makes reopening the popup request-free.
  useEffect(() => {
    if (!visible) {
      return;
    }
    enqueuePortfolioFetches(portfolioFetchQueue, fetchTargets, address =>
      fetchPerpsPortfolio(address, {
        maxAgeMs: PERPS_SELECTOR_PORTFOLIO_MAX_AGE_MS,
      }),
    );
  }, [fetchTargets, visible]);

  // The WS live value only describes this account — rows compare against it
  // so exactly one row upgrades to the realtime number.
  const currentPerpsAddress = useActivityStore(
    perpsStore,
    s => s.currentPerpsAccount?.address ?? null,
    Object.is,
    { storeLabel: 'perps-account-selector' },
  );

  const data = useMemo(
    () =>
      buildPerpsAccountSelectorData(
        addresses,
        perpsInfoByAddress,
        portfolioValueByAddress,
      ),
    [addresses, perpsInfoByAddress, portfolioValueByAddress],
  );

  const [tmpSelectAccount, setTmpSelectAccount] = useState<Account | null>(
    value || null,
  );

  const {
    loading,
    runAsync: runSelect,
    cancel: cancelSelect,
  } = useRequest(
    async (value: Account) => {
      await onChange?.(value);
    },
    {
      manual: true,
    },
  );

  const handleSelect = useMemoizedFn((value: Account) => {
    if (loading) {
      return;
    }
    setTmpSelectAccount(value);
    runSelect(value);
  });

  useEffect(() => {
    if (!visible) {
      setTmpSelectAccount(value || null);
      cancelSelect();
    } else {
      Promise.allSettled([
        fetchAccounts({ force: true }),
        getPinAddressesAsync(),
      ]);
      runGetLastUsedAccount();
    }
  }, [
    cancelSelect,
    fetchAccounts,
    getPinAddressesAsync,
    runGetLastUsedAccount,
    value,
    visible,
  ]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={onClose}
      enableDynamicSizing
      enableContentPanningGesture
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView>
        <AutoLockView style={[styles.container]}>
          <View>
            <Text style={styles.title}>{title || 'Select Account'}</Text>
          </View>
          {data.length ? (
            <View style={styles.section}>
              {data.map(item => {
                return (
                  <PerpsAccountSelectorItem
                    key={
                      item.account.address +
                      item.account.type +
                      item.account.brandName
                    }
                    account={item.account}
                    tmpSelectAccount={
                      tmpSelectAccount as KeyringAccountWithAlias
                    }
                    info={item?.info}
                    currentPerpsAddress={currentPerpsAddress}
                    lastUsedAccount={lastUsedAccount as KeyringAccountWithAlias}
                    loading={loading}
                    onPress={handleSelect}
                    currentAccount={value as KeyringAccountWithAlias}
                    checkIconPosition={checkIconPosition}
                  />
                );
              })}
            </View>
          ) : null}
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getModalStyle = createGetStyles2024(ctx => {
  const { colors2024, isLight } = ctx;
  return {
    handleStyle: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      paddingTop: 10,
      height: 36,
    },
    container: {
      // height: '100%',
      minHeight: 364,
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      paddingHorizontal: 20,
      // display: 'flex',
      // flexDirection: 'column',
      paddingBottom: 36,
    },
    title: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      marginBottom: 20,
      textAlign: 'center',
    },
    section: {
      // marginBottom: 12,
    },
    sectionHeader: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 6,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});
