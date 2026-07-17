import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useIsFocused } from '@react-navigation/native';

import { navigationRef } from '@/utils/navigation';

import {
  INACTIVE_REGRESSION_SCENARIO_CONTEXT,
  type ActiveRegressionScenarioContext,
  type RegressionScenarioCommand,
  type RegressionScenarioContext,
  type RegressionScreenId,
  type WithRegressionScenario,
} from './contracts';
import { executeRegressionScenarioCommand } from './coordinator';
import { scenarioIncludesScreen } from './registryMeta';
import {
  getRegressionScenarioRuntimeSnapshot,
  reportRegressionScenarioEvent,
  subscribeRegressionScenarioRuntime,
} from './runtime.nonprod';
import { claimRegressionScenarioAction } from './runtimeStore';

const ScenarioContext = createContext<RegressionScenarioContext>(
  INACTIVE_REGRESSION_SCENARIO_CONTEXT,
);

function useRuntimeSnapshot() {
  return useSyncExternalStore(
    subscribeRegressionScenarioRuntime,
    getRegressionScenarioRuntimeSnapshot,
    getRegressionScenarioRuntimeSnapshot,
  );
}

function makeScreenContext(
  screen: RegressionScreenId,
  enabled: boolean,
  command: RegressionScenarioCommand | null,
): RegressionScenarioContext {
  if (
    !enabled ||
    !command?.scenario ||
    (command.screen
      ? command.screen !== screen
      : !scenarioIncludesScreen(command.scenario, screen))
  ) {
    return INACTIVE_REGRESSION_SCENARIO_CONTEXT;
  }

  return {
    active: true,
    runId: command.runId,
    scenario: command.scenario,
    screen,
    action: command.action,
    fixture: command.fixture,
    credentialProfile: command.credentialProfile,
    params: command.params,
    claimOnce: actionKey =>
      claimRegressionScenarioAction(command.runId, actionKey),
    report: reportRegressionScenarioEvent,
  };
}

export const withRegressionScenario = ((
  Component: React.ComponentType<any>,
  options: {
    screen: RegressionScreenId;
    injectProps?: (context: ActiveRegressionScenarioContext) => object;
    displayName?: string;
  },
) => {
  function RegressionScenarioBoundary(props: object) {
    const snapshot = useRuntimeSnapshot();
    const isFocused = useIsFocused();
    const command = snapshot.command;
    const context = useMemo(
      () => makeScreenContext(options.screen, snapshot.enabled, command),
      [command, snapshot.enabled],
    );
    const activeContext = context.active ? context : null;

    useEffect(() => {
      if (!activeContext) {
        return;
      }
      activeContext.report('screen-mounted', { screen: options.screen });
      return () => {
        activeContext.report('screen-unmounted', { screen: options.screen });
      };
    }, [activeContext]);

    useEffect(() => {
      if (!activeContext) {
        return;
      }
      activeContext.report(isFocused ? 'screen-visible' : 'screen-hidden', {
        screen: options.screen,
      });
    }, [activeContext, isFocused]);

    const injectedProps =
      activeContext && options.injectProps
        ? options.injectProps(activeContext)
        : null;

    return (
      <ScenarioContext.Provider value={context}>
        <Component {...props} {...injectedProps} />
      </ScenarioContext.Provider>
    );
  }

  RegressionScenarioBoundary.displayName =
    options.displayName ||
    `withRegressionScenario(${
      Component.displayName || Component.name || options.screen
    })`;
  return RegressionScenarioBoundary;
}) as WithRegressionScenario;

export function useRegressionScenario<
  TScreen extends RegressionScreenId = RegressionScreenId,
>() {
  return useContext(ScenarioContext) as RegressionScenarioContext<TScreen>;
}

export function RegressionScenarioHost() {
  const snapshot = useRuntimeSnapshot();
  const lastCommandIdRef = useRef('');
  const command = snapshot.command;

  useEffect(() => {
    if (
      !snapshot.enabled ||
      !command ||
      lastCommandIdRef.current === command.commandId
    ) {
      return;
    }

    lastCommandIdRef.current = command.commandId;
    executeRegressionScenarioCommand(command).catch(console.error);
  }, [command, snapshot.enabled]);

  useEffect(() => {
    if (!snapshot.enabled) {
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const subscribe = () => {
      if (disposed) {
        return;
      }
      if (!navigationRef.isReady()) {
        retryTimer = setTimeout(subscribe, 100);
        return;
      }

      unsubscribe = navigationRef.addListener('state', () => {
        reportRegressionScenarioEvent('route-changed', {
          route: navigationRef.getCurrentRoute()?.name || null,
        });
      });
    };

    subscribe();
    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      unsubscribe?.();
    };
  }, [snapshot.enabled]);

  return null;
}
