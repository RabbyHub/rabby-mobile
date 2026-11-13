import {
  flushPullRefreshProbe,
  getPullRefreshProbeSnapshot,
  startPullRefreshProbe,
  stopPullRefreshProbe,
} from '@/devtools/pullRefreshProbe/controller';
import { storeApiExpSettingData } from '@/hooks/appSettings';
import type {
  RegressionScenarioCommand,
  RegressionScenarioSession,
} from './contracts';
import {
  handleRegressionScenarioCommand,
  restoreRegressionScenarioSession,
} from './runtime.nonprod';
import {
  clearRegressionScenarioRuntime,
  getRegressionScenarioRuntimeSnapshot,
  setRegressionScenarioRuntimeEnabled,
  subscribeRegressionScenarioRuntimeControl,
} from './runtimeStore';
import {
  readRegressionScenarioSession,
  removeRegressionScenarioSession,
  writeRegressionScenarioSession,
} from './sessionStore';

// Command-gate unit coverage: controller, settings and storage are outside this
// claim. This does not prove UI-runtime sampling or native iOS behavior.
const mockBuild = { nonProduction: true };
const mockSettings = { enabled: true };

jest.mock('@/constant', () => ({
  get isNonPublicProductionEnv() {
    return mockBuild.nonProduction;
  },
}));
jest.mock('@/hooks/appSettings', () => ({
  storeApiExpSettingData: {
    getScreenE2EEnabled: jest.fn(() => mockSettings.enabled),
    setScreenE2EEnabled: jest.fn((enabled: boolean) => {
      mockSettings.enabled = enabled;
    }),
  },
}));
jest.mock('./sessionStore', () => ({
  readRegressionScenarioSession: jest.fn(),
  writeRegressionScenarioSession: jest.fn(),
  removeRegressionScenarioSession: jest.fn(),
}));
jest.mock('@/core/state/renderActivityAudit', () => ({
  getRenderActivityAuditDiagnosticsSnapshot: jest.fn(),
}));
jest.mock('@/core/utils/featureActivationDiagnostics', () => ({
  getFeatureActivationDiagnosticsSnapshot: jest.fn(),
}));
jest.mock('@/core/utils/authReadinessDiagnostics', () => ({
  getAuthReadinessDiagnosticsSnapshot: jest.fn(),
}));
jest.mock('@/devtools/pullRefreshProbe/controller', () => ({
  startPullRefreshProbe: jest.fn(async () => undefined),
  stopPullRefreshProbe: jest.fn(async () => undefined),
  flushPullRefreshProbe: jest.fn(async () => undefined),
  getPullRefreshProbeSnapshot: jest.fn(() => ({
    active: false,
    runId: null,
    expiresAt: 0,
  })),
}));

const NOW = 1_800_000_000_000;
const PROBE_TARGETS = [
  {
    scenario: 'home-assets',
    screen: 'Home',
    params: { pullRefreshProbe: 'true' },
  },
  {
    scenario: 'perps-entry',
    screen: 'Perps',
    params: { perpsRootProbe: 'true' },
  },
] as const;

function makeCommand(
  patch: Partial<RegressionScenarioCommand> = {},
): RegressionScenarioCommand {
  return {
    mode: 'lifecycle-e2e',
    action: 'observe',
    commandId: 'command-pull-refresh',
    runId: 'pull-refresh-gate',
    scenario: 'home-assets',
    screen: 'Home',
    persistAcrossLaunches: false,
    expiresAt: NOW + 60_000,
    remainingLaunches: 1,
    params: { pullRefreshProbe: 'true' },
    ...patch,
  };
}

function expectNoProbeEffects() {
  expect(startPullRefreshProbe).not.toHaveBeenCalled();
  expect(stopPullRefreshProbe).not.toHaveBeenCalled();
  expect(flushPullRefreshProbe).not.toHaveBeenCalled();
  expect(getPullRefreshProbeSnapshot).not.toHaveBeenCalled();
}

describe('pull-refresh probe command gates (unit)', () => {
  it.each(['open', 'observe'] as const)(
    'arms pager observations only through perps-entry %s',
    action => {
      handleRegressionScenarioCommand(
        makeCommand({
          action,
          scenario: 'perps-entry',
          screen: 'Perps',
          params: { perpsRootProbe: 'true' },
        }),
      );
      expect(startPullRefreshProbe).toHaveBeenCalledWith({
        runId: 'pull-refresh-gate',
        expiresAt: NOW + 60_000,
        perpsRootProbe: true,
      });
    },
  );

  it.each([
    { action: 'start' as const },
    { screen: 'Home' as const },
    { scenario: 'home-assets' as const },
    { params: { perpsRootProbe: 'false' } },
    { expiresAt: NOW - 1 },
  ])('rejects a mismatched pager command %p', patch => {
    handleRegressionScenarioCommand(
      makeCommand({
        scenario: 'perps-entry',
        screen: 'Perps',
        params: { perpsRootProbe: 'true' },
        ...patch,
      }),
    );
    expect(startPullRefreshProbe).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBuild.nonProduction = true;
    mockSettings.enabled = true;
    jest.mocked(readRegressionScenarioSession).mockReturnValue(null);
    clearRegressionScenarioRuntime();
    setRegressionScenarioRuntimeEnabled(false);
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    clearRegressionScenarioRuntime();
    setRegressionScenarioRuntimeEnabled(false);
    jest.restoreAllMocks();
  });

  it.each(PROBE_TARGETS)(
    'observes $scenario without arming or persisting a scenario',
    target => {
      const command = makeCommand({ ...target, persistAcrossLaunches: true });

      expect(handleRegressionScenarioCommand(command)).toBe(true);

      expect(startPullRefreshProbe).toHaveBeenCalledTimes(1);
      expect(getRegressionScenarioRuntimeSnapshot()).toMatchObject({
        enabled: false,
        status: 'inactive',
        command: null,
        session: null,
        events: [],
      });
      expect(writeRegressionScenarioSession).not.toHaveBeenCalled();
      expect(removeRegressionScenarioSession).not.toHaveBeenCalled();
    },
  );

  it.each(PROBE_TARGETS)(
    'does not reactivate or replace an existing session while observing $scenario',
    target => {
      const previousCommand = makeCommand({
        action: 'open',
        params: {},
        persistAcrossLaunches: true,
      });
      handleRegressionScenarioCommand(previousCommand);
      setRegressionScenarioRuntimeEnabled(false);
      const previousSnapshot = getRegressionScenarioRuntimeSnapshot();
      const onControlChange = jest.fn();
      const unsubscribe =
        subscribeRegressionScenarioRuntimeControl(onControlChange);
      jest.clearAllMocks();

      try {
        handleRegressionScenarioCommand(makeCommand(target));

        expect(startPullRefreshProbe).toHaveBeenCalledTimes(1);
        expect(getRegressionScenarioRuntimeSnapshot()).toBe(previousSnapshot);
        expect(onControlChange).not.toHaveBeenCalled();
        expect(writeRegressionScenarioSession).not.toHaveBeenCalled();
        expect(removeRegressionScenarioSession).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );

  it.each(PROBE_TARGETS)(
    'preserves open activation and persistence for $scenario',
    target => {
      const command = makeCommand({
        ...target,
        action: 'open',
        persistAcrossLaunches: true,
      });

      handleRegressionScenarioCommand(command);

      expect(startPullRefreshProbe).toHaveBeenCalledTimes(1);
      expect(getRegressionScenarioRuntimeSnapshot()).toMatchObject({
        enabled: true,
        status: 'armed',
        command,
        session: { command },
      });
      expect(writeRegressionScenarioSession).toHaveBeenCalledWith(
        expect.objectContaining({ command, status: 'armed' }),
      );
      expect(removeRegressionScenarioSession).not.toHaveBeenCalled();
    },
  );

  it.each(['observe', 'status', 'cancel', 'configure'] as const)(
    'does nothing in a production build for %s',
    action => {
      mockBuild.nonProduction = false;

      expect(
        handleRegressionScenarioCommand(
          makeCommand({
            action,
            params: {
              pullRefreshProbe: 'true',
              includePullRefreshProbe: 'true',
              enabled: 'false',
            },
          }),
        ),
      ).toBe(false);

      expectNoProbeEffects();
      expect(storeApiExpSettingData.getScreenE2EEnabled).not.toHaveBeenCalled();
      expect(storeApiExpSettingData.setScreenE2EEnabled).not.toHaveBeenCalled();
    },
  );

  it('does not start when the persistent opt-in is off', () => {
    mockSettings.enabled = false;

    expect(handleRegressionScenarioCommand(makeCommand())).toBe(true);

    expectNoProbeEffects();
    expect(getRegressionScenarioRuntimeSnapshot().command).toBeNull();
  });

  it('does not start for a rejected command', () => {
    expect(handleRegressionScenarioCommand(null, 'invalid-command')).toBe(true);

    expectNoProbeEffects();
    expect(getRegressionScenarioRuntimeSnapshot().command).toBeNull();
  });

  it.each([NOW - 1, NOW])(
    'does not start an expired command (expiresAt=%s)',
    expiresAt => {
      handleRegressionScenarioCommand(makeCommand({ expiresAt }));

      expectNoProbeEffects();
      expect(getRegressionScenarioRuntimeSnapshot().command).toBeNull();
    },
  );

  it.each(['lock-unlock', 'single-address', undefined] as const)(
    'does not start for a non-Home scenario (%s)',
    scenario => {
      handleRegressionScenarioCommand(makeCommand({ scenario }));

      expectNoProbeEffects();
    },
  );

  it('does not start when Home assets explicitly targets another Screen', () => {
    handleRegressionScenarioCommand(makeCommand({ screen: 'Unlock' }));

    expectNoProbeEffects();
  });

  it.each(['start', 'prepare', 'finish'] as const)(
    'does not start from the non-observation action %s',
    action => {
      handleRegressionScenarioCommand(makeCommand({ action }));

      expectNoProbeEffects();
    },
  );

  it.each([undefined, 'false', '1', 'TRUE'])(
    'does not infer opt-in from pullRefreshProbe=%s',
    flag => {
      handleRegressionScenarioCommand(
        makeCommand({
          params: flag === undefined ? {} : { pullRefreshProbe: flag },
        }),
      );

      expectNoProbeEffects();
    },
  );

  it.each(['open', 'observe'] as const)(
    'starts only the explicit valid Home %s probe',
    action => {
      const command = makeCommand({ action });

      expect(handleRegressionScenarioCommand(command)).toBe(true);

      expect(startPullRefreshProbe).toHaveBeenCalledTimes(1);
      expect(startPullRefreshProbe).toHaveBeenCalledWith({
        runId: command.runId,
        expiresAt: command.expiresAt,
      });
      expect(getRegressionScenarioRuntimeSnapshot().command).toBe(
        action === 'observe' ? null : command,
      );
      expect(stopPullRefreshProbe).not.toHaveBeenCalled();
      expect(flushPullRefreshProbe).not.toHaveBeenCalled();
    },
  );

  it('allows Home scenario routing without an explicit Screen selector', () => {
    const command = makeCommand({ screen: undefined });

    handleRegressionScenarioCommand(command);

    expect(startPullRefreshProbe).toHaveBeenCalledWith({
      runId: command.runId,
      expiresAt: command.expiresAt,
    });
  });

  it.each(['open', 'observe', 'start', 'prepare', 'finish'] as const)(
    'preserves an ordinary Home %s command without diagnostic side effects',
    action => {
      const command = makeCommand({ action, params: {} });

      handleRegressionScenarioCommand(command);

      expectNoProbeEffects();
      expect(getRegressionScenarioRuntimeSnapshot().command).toBe(command);
    },
  );

  it.each([undefined, 'false', '1'])(
    'does not flush an ordinary status request (includePullRefreshProbe=%s)',
    flag => {
      handleRegressionScenarioCommand(
        makeCommand({
          action: 'status',
          params: flag === undefined ? {} : { includePullRefreshProbe: flag },
        }),
      );

      expectNoProbeEffects();
    },
  );

  it('flushes only an explicitly opted-in status request', () => {
    handleRegressionScenarioCommand(
      makeCommand({
        action: 'status',
        params: { includePullRefreshProbe: 'true' },
      }),
    );

    expect(flushPullRefreshProbe).toHaveBeenCalledTimes(1);
    expect(getPullRefreshProbeSnapshot).toHaveBeenCalledTimes(1);
    expect(startPullRefreshProbe).not.toHaveBeenCalled();
    expect(stopPullRefreshProbe).not.toHaveBeenCalled();
  });

  it('does not flush status while the persistent switch is disabled', () => {
    mockSettings.enabled = false;

    handleRegressionScenarioCommand(
      makeCommand({
        action: 'status',
        params: { includePullRefreshProbe: 'true' },
      }),
    );

    expect(flushPullRefreshProbe).not.toHaveBeenCalled();
    expect(startPullRefreshProbe).not.toHaveBeenCalled();
    expect(stopPullRefreshProbe).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'clear-session'] as const)(
    'stops a probe when the command is %s',
    action => {
      handleRegressionScenarioCommand(makeCommand());
      jest.clearAllMocks();

      handleRegressionScenarioCommand(makeCommand({ action, params: {} }));

      expect(stopPullRefreshProbe).toHaveBeenCalledTimes(1);
      expect(stopPullRefreshProbe).toHaveBeenCalledWith(action);
      expect(startPullRefreshProbe).not.toHaveBeenCalled();
      expect(flushPullRefreshProbe).not.toHaveBeenCalled();
    },
  );

  it('stops a probe when the persistent opt-in is disabled', () => {
    handleRegressionScenarioCommand(makeCommand());
    jest.clearAllMocks();

    handleRegressionScenarioCommand(
      makeCommand({ action: 'configure', params: { enabled: 'false' } }),
    );

    expect(storeApiExpSettingData.setScreenE2EEnabled).toHaveBeenCalledWith(
      false,
    );
    expect(mockSettings.enabled).toBe(false);
    expect(stopPullRefreshProbe).toHaveBeenCalledWith('disabled');
    expect(startPullRefreshProbe).not.toHaveBeenCalled();
    expect(getRegressionScenarioRuntimeSnapshot().command).toBeNull();
  });

  it('does not start a probe merely by enabling the persistent switch', () => {
    mockSettings.enabled = false;

    handleRegressionScenarioCommand(
      makeCommand({
        action: 'configure',
        params: { enabled: 'true', pullRefreshProbe: 'true' },
      }),
    );

    expect(mockSettings.enabled).toBe(true);
    expectNoProbeEffects();
  });

  it('does not rearm a diagnostic probe from a persisted session', () => {
    const command = makeCommand({ persistAcrossLaunches: true });
    const session: RegressionScenarioSession = {
      version: 1,
      command,
      status: 'armed',
      createdAt: NOW - 1000,
      updatedAt: NOW - 1000,
    };
    jest.mocked(readRegressionScenarioSession).mockReturnValue(session);

    const restored = restoreRegressionScenarioSession();

    expect(restored?.command.runId).toBe(command.runId);
    expectNoProbeEffects();
  });
});
