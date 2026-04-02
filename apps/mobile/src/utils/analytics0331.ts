import { TIME_SETTINGS } from '@/constant/autoLock';
import { TokenDisplayMode } from '@/core/services/preference';
import { zustandByMMKV } from '@/core/storage/mmkv';
import { useMyAccounts } from '@/hooks/account';
import { useAppNotificationEnabled } from '@/hooks/appNotification';
import { useAutoLockTime } from '@/hooks/appTimeout';
import { useBiometrics } from '@/hooks/biometrics';
import { useCurrency } from '@/hooks/useCurrency';
import { useAppLanguage } from '@/hooks/lang';
import { FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT } from '@/components/Screenshot/hooks';
import { useScreenshotToReportEnabled } from '@/components/Screenshot/hooks';
import { useFocusEffect } from '@react-navigation/native';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { SupportedLang } from '@/utils/i18n';
import { IProtocolItem, useProtocolListStore } from '@/store/protocols';
import { isAppChain } from '@/screens/Home/utils/appchain';
import { matomoRequestEvent } from './analytics';

type SettingsSnapshotPayload = {
  biometricsEnabled: boolean;
  txNotificationEnabled: boolean;
  autoLockTimeMs: number;
  currentLanguage: SupportedLang;
  currencyCode: string;
  screenshotToBugEnabled: boolean;
};

type SnapshotTrackedStore = Record<string, number>;
export type Report0331SnapshotTrackKey =
  | 'Settings_FaceID'
  | 'Settings_TxNoti'
  | 'Settings_LockTime'
  | 'Settings_Language'
  | 'Settings_Currency'
  | 'Settings_SStoBug'
  | 'Lending_UserStatus';

type Report0331SnapshotScenarioOption = {
  trackKey: Report0331SnapshotTrackKey;
  title: string;
  category: string;
  action: string;
  keywords: string[];
};

export const report0331SnapshotScenarioOptions: Report0331SnapshotScenarioOption[] =
  [
    {
      trackKey: 'Settings_FaceID',
      title: 'Home Active / Settings Face ID',
      category: 'Settings Snapshot',
      action: 'Settings_FaceID',
      keywords: [
        'home active',
        'snapshot',
        'settings',
        'face id',
        'biometrics',
      ],
    },
    {
      trackKey: 'Settings_TxNoti',
      title: 'Home Active / Settings Txn Notifications',
      category: 'Settings Snapshot',
      action: 'Settings_TxNoti',
      keywords: ['home active', 'snapshot', 'settings', 'txn', 'notifications'],
    },
    {
      trackKey: 'Settings_LockTime',
      title: 'Home Active / Settings Auto Lock Time',
      category: 'Settings Snapshot',
      action: 'Settings_LockTime',
      keywords: [
        'home active',
        'snapshot',
        'settings',
        'auto lock',
        'lock time',
      ],
    },
    {
      trackKey: 'Settings_Language',
      title: 'Home Active / Settings Language',
      category: 'Settings Snapshot',
      action: 'Settings_Language',
      keywords: ['home active', 'snapshot', 'settings', 'language'],
    },
    {
      trackKey: 'Settings_Currency',
      title: 'Home Active / Settings Currency',
      category: 'Settings Snapshot',
      action: 'Settings_Currency',
      keywords: ['home active', 'snapshot', 'settings', 'currency'],
    },
    {
      trackKey: 'Settings_SStoBug',
      title: 'Home Active / Settings Screenshot To Report Bug',
      category: 'Settings Snapshot',
      action: 'Settings_SStoBug',
      keywords: [
        'home active',
        'snapshot',
        'settings',
        'screenshot',
        'report bug',
      ],
    },
    {
      trackKey: 'Lending_UserStatus',
      title: 'Home Active / Rabby Lending User Status',
      category: 'Rabby Lending',
      action: 'Lending_UserStatus',
      keywords: ['home active', 'snapshot', 'lending', 'aave', 'user status'],
    },
  ];

const snapshotTrackedStore = zustandByMMKV<SnapshotTrackedStore>(
  '@0331reportSnapshotTracked',
  {},
);

export const useReport0331SnapshotTrackedState = () => {
  return snapshotTrackedStore(state => state);
};

export const get0331SnapshotTrackedAt = (key: Report0331SnapshotTrackKey) => {
  return snapshotTrackedStore.getState()[key] || 0;
};

export const get0331SnapshotResetAt = (trackedAt?: number) => {
  if (!trackedAt || trackedAt <= 0) {
    return 0;
  }

  return dayjs(trackedAt).utc().startOf('day').add(1, 'day').valueOf();
};

export const reset0331ReportSnapshotTracked = () => {
  snapshotTrackedStore.setState({}, true);
};

export const reset0331ReportSnapshotTrackedByKeys = (
  keys: readonly Report0331SnapshotTrackKey[],
) => {
  if (!keys.length) {
    return;
  }

  snapshotTrackedStore.setState(prev => {
    const next = { ...prev };
    keys.forEach(key => {
      delete next[key];
    });
    return next;
  }, true);
};

const AAVE_ORIGIN = (
  safeGetOrigin('https://app.aave.com') ||
  safeGetOrigin('app.aave.com') ||
  'https://app.aave.com'
).toLowerCase();

const pendingSnapshotTrackKeys = new Set<string>();

const getOnOffLabel = (enabled: boolean) => {
  return enabled ? 'On' : 'Off';
};

const getTokenSortModeLabel = (mode: TokenDisplayMode) => {
  return mode;
};

const getAutoLockTimeLabel = (timeoutMs: number) => {
  const matched = TIME_SETTINGS.find(item => item.milliseconds === timeoutMs);
  if (matched) {
    return matched.key;
  }

  return `${timeoutMs}ms`;
};

const getLanguageLabel = (lang: SupportedLang) => {
  return lang;
};

const hasTrackedSnapshotToday = (key: string) => {
  const trackedAt = snapshotTrackedStore.getState()[key] || 0;
  return dayjs(trackedAt).utc().isSame(dayjs().utc(), 'day');
};

const markSnapshotTracked = (key: string, timestamp = Date.now()) => {
  snapshotTrackedStore.setState(prev => ({
    ...prev,
    [key]: timestamp,
  }));
};

const trackSnapshotEventOncePerDay = async (input: {
  trackKey: string;
  category: string;
  action: string;
  label?: string;
}) => {
  if (
    pendingSnapshotTrackKeys.has(input.trackKey) ||
    hasTrackedSnapshotToday(input.trackKey)
  ) {
    return false;
  }

  pendingSnapshotTrackKeys.add(input.trackKey);
  try {
    await matomoRequestEvent({
      category: input.category,
      action: input.action,
      label: input.label,
    });
    markSnapshotTracked(input.trackKey);
    return true;
  } finally {
    pendingSnapshotTrackKeys.delete(input.trackKey);
  }
};

export const trackSettingsFaceId = async (enabled: boolean) => {
  return matomoRequestEvent({
    category: 'Settings Snapshot',
    action: 'Settings_FaceID',
    label: getOnOffLabel(enabled),
  });
};

export const trackSettingsTxNotification = async (enabled: boolean) => {
  return matomoRequestEvent({
    category: 'Settings Snapshot',
    action: 'Settings_TxNoti',
    label: getOnOffLabel(enabled),
  });
};

export const trackSettingsLockTime = async (timeoutMs: number) => {
  return matomoRequestEvent({
    category: 'Settings Snapshot',
    action: 'Settings_LockTime',
    label: getAutoLockTimeLabel(timeoutMs),
  });
};

export const trackSettingsLanguage = async (lang: SupportedLang) => {
  return matomoRequestEvent({
    category: 'Settings Snapshot',
    action: 'Settings_Language',
    label: getLanguageLabel(lang),
  });
};

export const trackSettingsCurrency = async (currencyCode: string) => {
  return matomoRequestEvent({
    category: 'Settings Snapshot',
    action: 'Settings_Currency',
    label: currencyCode,
  });
};

export const trackSettingsScreenshotToBug = async (enabled: boolean) => {
  return matomoRequestEvent({
    category: 'Settings Snapshot',
    action: 'Settings_SStoBug',
    label: getOnOffLabel(enabled),
  });
};

export const trackSettingsSnapshotsOncePerDay = async (
  payload: SettingsSnapshotPayload,
) => {
  await Promise.all([
    trackSnapshotEventOncePerDay({
      trackKey: 'Settings_FaceID',
      category: 'Settings Snapshot',
      action: 'Settings_FaceID',
      label: getOnOffLabel(payload.biometricsEnabled),
    }),
    trackSnapshotEventOncePerDay({
      trackKey: 'Settings_TxNoti',
      category: 'Settings Snapshot',
      action: 'Settings_TxNoti',
      label: getOnOffLabel(payload.txNotificationEnabled),
    }),
    trackSnapshotEventOncePerDay({
      trackKey: 'Settings_LockTime',
      category: 'Settings Snapshot',
      action: 'Settings_LockTime',
      label: getAutoLockTimeLabel(payload.autoLockTimeMs),
    }),
    trackSnapshotEventOncePerDay({
      trackKey: 'Settings_Language',
      category: 'Settings Snapshot',
      action: 'Settings_Language',
      label: getLanguageLabel(payload.currentLanguage),
    }),
    trackSnapshotEventOncePerDay({
      trackKey: 'Settings_Currency',
      category: 'Settings Snapshot',
      action: 'Settings_Currency',
      label: payload.currencyCode,
    }),
    trackSnapshotEventOncePerDay({
      trackKey: 'Settings_SStoBug',
      category: 'Settings Snapshot',
      action: 'Settings_SStoBug',
      label: getOnOffLabel(payload.screenshotToBugEnabled),
    }),
  ]);
};

export const trackHomeTabViewToken = async (mode: TokenDisplayMode) => {
  return matomoRequestEvent({
    category: 'HomeTab',
    action: 'HomeTab_ViewToken',
    label: getTokenSortModeLabel(mode),
  });
};

const isAaveProtocolItem = (protocol: IProtocolItem) => {
  const origin =
    safeGetOrigin(protocol.site_url || '') ||
    safeGetOrigin(`https://${protocol.site_url}`) ||
    protocol.site_url ||
    '';

  return !!origin && origin.toLowerCase() === AAVE_ORIGIN;
};

const hasAavePortfolioData = (protocol: IProtocolItem) => {
  if (!protocol._portfolios?.length) {
    return false;
  }

  return protocol._portfolios.some(portfolio => {
    if (Number(portfolio.netWorth || 0) !== 0) {
      return true;
    }

    return (
      portfolio._originPortfolio?.asset_token_list?.some(token => {
        return Number(token.amount || 0) !== 0;
      }) || false
    );
  });
};

export const getLendingUserStatusLabel = (
  addresses: string[],
  protocolMap: Record<string, IProtocolItem[]>,
) => {
  if (!addresses.length) {
    return undefined;
  }

  const chainSet = new Set<string>();
  let addressCount = 0;

  Array.from(new Set(addresses.map(address => address.toLowerCase()))).forEach(
    address => {
      const aaveProtocols = (protocolMap[address] || []).filter(protocol => {
        return (
          !!protocol.chain &&
          !isAppChain(protocol.chain) &&
          isAaveProtocolItem(protocol) &&
          hasAavePortfolioData(protocol)
        );
      });

      if (!aaveProtocols.length) {
        return;
      }

      addressCount += 1;
      aaveProtocols.forEach(protocol => {
        if (protocol.chain) {
          chainSet.add(protocol.chain);
        }
      });
    },
  );

  if (!addressCount || !chainSet.size) {
    return undefined;
  }

  const chainLabel = chainSet.size > 1 ? 'MC' : 'SC';
  const addressLabel = addressCount > 1 ? 'MA' : 'SA';
  return `${chainLabel}_${addressLabel}`;
};

export const trackLendingUserStatus = async (label: string) => {
  return matomoRequestEvent({
    category: 'Rabby Lending',
    action: 'Lending_UserStatus',
    label,
  });
};

export const trackLendingUserStatusOncePerDay = async (label: string) => {
  return trackSnapshotEventOncePerDay({
    trackKey: 'Lending_UserStatus',
    category: 'Rabby Lending',
    action: 'Lending_UserStatus',
    label,
  });
};

export const useTrack0331HomeActiveSnapshots = () => {
  const { biometrics } = useBiometrics({ autoFetch: true });
  const {
    enabledTransactionNofification,
    hasSystemPermission,
    value: txNotificationEnabled,
  } = useAppNotificationEnabled();
  const { timeoutMs } = useAutoLockTime();
  const { currentLanguage } = useAppLanguage();
  const { currency } = useCurrency();
  const { isShowFeedbackOnScreenshot } = useScreenshotToReportEnabled();
  const { accounts } = useMyAccounts();
  const protocolMap = useProtocolListStore(state => state.protocolMap);

  const settingsSnapshot = useMemo<SettingsSnapshotPayload>(() => {
    return {
      biometricsEnabled: biometrics.authEnabled,
      txNotificationEnabled:
        hasSystemPermission === null
          ? enabledTransactionNofification
          : txNotificationEnabled,
      autoLockTimeMs: timeoutMs,
      currentLanguage,
      currencyCode: currency.code,
      screenshotToBugEnabled: FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT
        ? false
        : isShowFeedbackOnScreenshot,
    };
  }, [
    currency.code,
    currentLanguage,
    biometrics.authEnabled,
    enabledTransactionNofification,
    hasSystemPermission,
    isShowFeedbackOnScreenshot,
    timeoutMs,
    txNotificationEnabled,
  ]);

  const lendingUserStatus = useMemo(() => {
    return getLendingUserStatusLabel(
      accounts.map(account => account.address),
      protocolMap,
    );
  }, [accounts, protocolMap]);

  const shouldAttemptLendingSnapshotRef = useRef(false);

  const trackHomeSnapshots = useCallback(() => {
    trackSettingsSnapshotsOncePerDay(settingsSnapshot).catch(error => {
      console.error('trackSettingsSnapshotsOncePerDay failed', error);
    });

    if (!lendingUserStatus) {
      return;
    }

    trackLendingUserStatusOncePerDay(lendingUserStatus).catch(error => {
      console.error('trackLendingUserStatusOncePerDay failed', error);
    });
  }, [lendingUserStatus, settingsSnapshot]);

  useFocusEffect(
    useCallback(() => {
      shouldAttemptLendingSnapshotRef.current = true;
      trackHomeSnapshots();

      const subscription = AppState.addEventListener('change', state => {
        if (state !== 'active') {
          return;
        }

        shouldAttemptLendingSnapshotRef.current = true;
        trackHomeSnapshots();
      });

      return () => {
        shouldAttemptLendingSnapshotRef.current = false;
        subscription.remove();
      };
    }, [trackHomeSnapshots]),
  );

  useEffect(() => {
    if (!shouldAttemptLendingSnapshotRef.current || !lendingUserStatus) {
      return;
    }

    trackLendingUserStatusOncePerDay(lendingUserStatus).catch(error => {
      console.error('trackLendingUserStatusOncePerDay failed', error);
    });
  }, [lendingUserStatus]);
};

export const useTrackLendingUserStatusChanges = (label?: string) => {
  const hasInitializedRef = useRef(false);
  const previousLabelRef = useRef<string | undefined>();

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      previousLabelRef.current = label;
      return;
    }

    if (previousLabelRef.current === label) {
      return;
    }

    previousLabelRef.current = label;

    if (!label) {
      return;
    }

    trackLendingUserStatus(label).catch(error => {
      console.error('trackLendingUserStatus failed', error);
    });
  }, [label]);
};
