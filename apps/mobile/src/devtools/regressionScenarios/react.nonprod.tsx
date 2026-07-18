import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import { navigationRef } from '@/utils/navigation';

import {
  INACTIVE_REGRESSION_SCENARIO_CONTEXT,
  type ActiveRegressionScenarioContext,
  type RegressionScenarioCommand,
  type RegressionScenarioContext,
  type RegressionScenarioRuntimeContext,
  type RegressionScreenId,
  type WithRegressionScenario,
} from './contracts';
import { executeRegressionScenarioCommand } from './coordinator';
import { scenarioIncludesScreen } from './registryMeta';
import {
  getRegressionScenarioRuntimeControlSnapshot,
  reportRegressionScenarioEvent,
  subscribeRegressionScenarioRuntimeControl,
} from './runtime.nonprod';
import { claimRegressionScenarioAction } from './runtimeStore';
import { makeScreenContext } from './screenContext';

const ScenarioContext = createContext<RegressionScenarioContext>(
  INACTIVE_REGRESSION_SCENARIO_CONTEXT,
);

type ScreenNavigation = {
  isFocused?: () => boolean;
  addListener?: (
    event: 'focus' | 'blur',
    listener: () => void,
  ) => (() => void) | undefined;
};

function useRuntimeSnapshot() {
  return useSyncExternalStore(
    subscribeRegressionScenarioRuntimeControl,
    getRegressionScenarioRuntimeControlSnapshot,
    getRegressionScenarioRuntimeControlSnapshot,
  );
}

const screenContextRuntime = {
  scenarioIncludesScreen,
  claimAction: claimRegressionScenarioAction,
  report: reportRegressionScenarioEvent,
};

export const withRegressionScenario = ((
  Component: React.ComponentType<any>,
  options: {
    screen: RegressionScreenId;
    injectProps?: (context: ActiveRegressionScenarioContext) => object;
    displayName?: string;
  },
) => {
  function EnabledRegressionScenarioBoundary({
    command,
    componentProps,
  }: {
    command: RegressionScenarioCommand | null;
    componentProps: object;
  }) {
    const navigation = (componentProps as { navigation?: ScreenNavigation })
      .navigation;
    const context = useMemo(
      () =>
        makeScreenContext(
          options.screen,
          true,
          command,
          () => navigation?.isFocused?.() ?? true,
          screenContextRuntime,
        ),
      [command, navigation],
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

      let lastVisible: boolean | null = null;
      const reportVisibility = (visible: boolean) => {
        if (lastVisible === visible) {
          return;
        }
        lastVisible = visible;
        activeContext.report(visible ? 'screen-visible' : 'screen-hidden', {
          screen: options.screen,
        });
      };
      if (navigation?.isFocused?.()) {
        reportVisibility(true);
      }
      const unsubscribeFocus = navigation?.addListener?.('focus', () => {
        reportVisibility(true);
      });
      const unsubscribeBlur = navigation?.addListener?.('blur', () => {
        reportVisibility(false);
      });

      return () => {
        unsubscribeFocus?.();
        unsubscribeBlur?.();
      };
    }, [activeContext, navigation]);

    const injectedProps =
      activeContext && options.injectProps
        ? options.injectProps(activeContext)
        : null;

    return (
      <ScenarioContext.Provider value={context}>
        <Component {...componentProps} {...injectedProps} />
      </ScenarioContext.Provider>
    );
  }

  function RegressionScenarioBoundary(props: object) {
    const snapshot = useRuntimeSnapshot();

    if (!snapshot.enabled) {
      return <Component {...props} />;
    }

    return (
      <EnabledRegressionScenarioBoundary
        command={snapshot.command}
        componentProps={props}
      />
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

export function useRegressionScenarioRuntime(): RegressionScenarioRuntimeContext {
  const snapshot = useRuntimeSnapshot();
  const command = snapshot.command;

  return useMemo(() => {
    if (!snapshot.enabled || !command?.scenario) {
      return INACTIVE_REGRESSION_SCENARIO_CONTEXT;
    }

    return {
      active: true,
      runId: command.runId,
      scenario: command.scenario,
      screen: command.screen,
      action: command.action,
      fixture: command.fixture,
      credentialProfile: command.credentialProfile,
      params: command.params,
      claimOnce: actionKey =>
        claimRegressionScenarioAction(command.runId, actionKey),
      report: reportRegressionScenarioEvent,
    };
  }, [command, snapshot.enabled]);
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
