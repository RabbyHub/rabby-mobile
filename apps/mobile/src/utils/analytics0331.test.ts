const mockMatomoRequestEvent = jest.fn();

jest.mock('@/constant/autoLock', () => ({
  TIME_SETTINGS: [
    {
      key: '24h',
      milliseconds: 24 * 60 * 60 * 1000,
    },
    {
      key: '5m',
      milliseconds: 5 * 60 * 1000,
    },
  ],
}));

jest.mock('@/core/storage/mmkv', () => ({
  zustandByMMKV: (_key: string, initialState: Record<string, number>) => {
    let state = initialState;
    const store = (selector: (value: Record<string, number>) => unknown) =>
      selector(state);
    store.getState = () => state;
    store.setState = (
      updater:
        | Record<string, number>
        | ((value: Record<string, number>) => Record<string, number>),
      replace?: boolean,
    ) => {
      const nextState =
        typeof updater === 'function' ? updater(state) : updater;
      state = replace ? nextState : { ...state, ...nextState };
    };
    return store;
  },
}));

jest.mock('@/hooks/appNotification', () => ({
  useAppNotificationEnabled: jest.fn(() => ({
    enabledTransactionNofification: true,
    hasSystemPermission: true,
    value: true,
  })),
}));

jest.mock('@/hooks/appTimeout', () => ({
  useAutoLockTime: jest.fn(() => ({
    timeoutMs: 24 * 60 * 60 * 1000,
  })),
}));

jest.mock('@/hooks/biometrics', () => ({
  useBiometrics: jest.fn(() => ({
    biometrics: {
      authEnabled: true,
    },
  })),
}));

jest.mock('@/hooks/useCurrency', () => ({
  useCurrency: jest.fn(() => ({
    currency: {
      code: 'USD',
    },
  })),
}));

jest.mock('@/hooks/lang', () => ({
  useAppLanguage: jest.fn(() => ({
    currentLanguage: 'en',
  })),
}));

jest.mock('@/components/Screenshot/hooks', () => ({
  FORCE_DISABLE_FEEDBACK_BY_SCREENSHOT: false,
  useScreenshotToReportEnabled: jest.fn(() => ({
    isShowFeedbackOnScreenshot: true,
  })),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  },
}));

jest.mock('./analytics', () => ({
  matomoRequestEvent: (...args: unknown[]) => mockMatomoRequestEvent(...args),
}));

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  get0331SnapshotResetAt,
  get0331SnapshotTrackedAt,
  report0331SnapshotScenarioOptions,
  reset0331ReportSnapshotTracked,
  reset0331ReportSnapshotTrackedByKeys,
  trackSettingsCurrency,
  trackSettingsFaceId,
  trackSettingsLanguage,
  trackSettingsLockTime,
  trackSettingsScreenshotToBug,
  trackSettingsSnapshotsOncePerDay,
  trackSettingsTxNotification,
} from './analytics0331';

dayjs.extend(utc);

const snapshotPayload = {
  biometricsEnabled: true,
  txNotificationEnabled: false,
  autoLockTimeMs: 5 * 60 * 1000,
  currentLanguage: 'en' as const,
  currencyCode: 'USD',
  screenshotToBugEnabled: true,
};

describe('analytics0331 settings snapshot tracking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-30T10:15:00.000Z'));
    reset0331ReportSnapshotTracked();
    mockMatomoRequestEvent.mockReset();
    mockMatomoRequestEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports direct setting snapshots with normalized labels', async () => {
    await trackSettingsFaceId(true);
    await trackSettingsTxNotification(false);
    await trackSettingsLockTime(5 * 60 * 1000);
    await trackSettingsLockTime(1234);
    await trackSettingsLanguage('en');
    await trackSettingsCurrency('USD');
    await trackSettingsScreenshotToBug(false);

    expect(mockMatomoRequestEvent.mock.calls).toEqual([
      [
        {
          category: 'Settings Snapshot',
          action: 'Settings_FaceID',
          label: 'On',
        },
      ],
      [
        {
          category: 'Settings Snapshot',
          action: 'Settings_TxNoti',
          label: 'Off',
        },
      ],
      [
        {
          category: 'Settings Snapshot',
          action: 'Settings_LockTime',
          label: '5m',
        },
      ],
      [
        {
          category: 'Settings Snapshot',
          action: 'Settings_LockTime',
          label: '1234ms',
        },
      ],
      [
        {
          category: 'Settings Snapshot',
          action: 'Settings_Language',
          label: 'en',
        },
      ],
      [
        {
          category: 'Settings Snapshot',
          action: 'Settings_Currency',
          label: 'USD',
        },
      ],
      [
        {
          category: 'Settings Snapshot',
          action: 'Settings_SStoBug',
          label: 'Off',
        },
      ],
    ]);
  });

  it('tracks each settings snapshot once per UTC day', async () => {
    await trackSettingsSnapshotsOncePerDay(snapshotPayload);
    await trackSettingsSnapshotsOncePerDay({
      ...snapshotPayload,
      biometricsEnabled: false,
      currencyCode: 'EUR',
    });

    expect(mockMatomoRequestEvent).toHaveBeenCalledTimes(6);
    expect(get0331SnapshotTrackedAt('Settings_FaceID')).toBe(
      new Date('2026-05-30T10:15:00.000Z').valueOf(),
    );
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Settings Snapshot',
      action: 'Settings_FaceID',
      label: 'On',
    });
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Settings Snapshot',
      action: 'Settings_Currency',
      label: 'USD',
    });

    jest.setSystemTime(new Date('2026-05-31T00:01:00.000Z'));

    await trackSettingsSnapshotsOncePerDay({
      ...snapshotPayload,
      biometricsEnabled: false,
      currencyCode: 'EUR',
    });

    expect(mockMatomoRequestEvent).toHaveBeenCalledTimes(12);
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Settings Snapshot',
      action: 'Settings_FaceID',
      label: 'Off',
    });
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith({
      category: 'Settings Snapshot',
      action: 'Settings_Currency',
      label: 'EUR',
    });
  });

  it('prevents duplicate pending snapshot reports for the same keys', async () => {
    let resolveMatomo: () => void = () => {};
    const pendingMatomo = new Promise<void>(resolve => {
      resolveMatomo = resolve;
    });
    mockMatomoRequestEvent.mockImplementation(() => pendingMatomo);

    const first = trackSettingsSnapshotsOncePerDay(snapshotPayload);
    const second = trackSettingsSnapshotsOncePerDay(snapshotPayload);

    expect(mockMatomoRequestEvent).toHaveBeenCalledTimes(6);

    resolveMatomo();
    await Promise.all([first, second]);

    expect(mockMatomoRequestEvent).toHaveBeenCalledTimes(6);
  });

  it('resets tracked state globally or by specific keys', async () => {
    await trackSettingsSnapshotsOncePerDay(snapshotPayload);

    reset0331ReportSnapshotTrackedByKeys([
      'Settings_FaceID',
      'Settings_Currency',
    ]);

    expect(get0331SnapshotTrackedAt('Settings_FaceID')).toBe(0);
    expect(get0331SnapshotTrackedAt('Settings_Currency')).toBe(0);
    expect(get0331SnapshotTrackedAt('Settings_Language')).toBeGreaterThan(0);

    reset0331ReportSnapshotTracked();

    expect(get0331SnapshotTrackedAt('Settings_Language')).toBe(0);
  });

  it('computes the next UTC reset timestamp for tracked snapshots', () => {
    expect(get0331SnapshotResetAt(0)).toBe(0);
    expect(
      get0331SnapshotResetAt(new Date('2026-05-30T10:15:00.000Z').valueOf()),
    ).toBe(new Date('2026-05-31T00:00:00.000Z').valueOf());
  });

  it('keeps scenario options unique and searchable by track key', () => {
    const keys = report0331SnapshotScenarioOptions.map(item => item.trackKey);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(
      expect.arrayContaining([
        'Settings_FaceID',
        'Settings_TxNoti',
        'Settings_LockTime',
        'Settings_Language',
        'Settings_Currency',
        'Settings_SStoBug',
        'Lending_UserStatus',
      ]),
    );
    expect(
      report0331SnapshotScenarioOptions.find(
        item => item.trackKey === 'Lending_UserStatus',
      ),
    ).toMatchObject({
      category: 'Rabby Lending',
      action: 'Lending_UserStatus',
    });
  });
});
