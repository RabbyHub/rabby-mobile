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
import { registerRegressionScenarioComponentAction } from './componentActions.nonprod';
import { claimRegressionScenarioAction } from './runtimeStore';
import { makeScreenContext } from './screenContext';
import { recordScreenRenderFailure } from '@/devtools/screenRegistry/probe';
import { getLatestNavigationName } from '@/utils/navigation';

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

class ScreenRenderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      '[screenRegistry] screen render failed; app shell kept alive:',
      error?.message,
      info?.componentStack?.split('\n').slice(0, 4).join(' | '),
    );
    // iOS device sweeps cannot read the JS console, so record the failing
    // route in the sandbox probe file the sweep host reads.
    void recordScreenRenderFailure(getLatestNavigationName() || 'unknown');
  }

  render() {
    if (this.state.error) {
      const { View, Text } = require('react-native');
      return (
        <View
          style={{
            flex: 1,
            padding: 24,
            justifyContent: 'center',
            backgroundColor: '#1b1b1f',
          }}>
          <Text style={{ color: '#ff6b6b', fontSize: 18, marginBottom: 8 }}>
            Screen render failed
          </Text>
          <Text style={{ color: '#e6e6e6', fontSize: 13 }}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/**
 * Non-production only: keeps the app shell (and therefore the universal-link
 * hook) alive when one screen throws while rendering. Without it a single bad
 * screen unmounts the whole tree, after which every later debug deeplink is
 * dropped. The production variant is the identity function.
 */
export function withScreenErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
) {
  return function ScreenErrorBoundaryBoundary(props: P) {
    return (
      <ScreenRenderErrorBoundary>
        <Component {...props} />
      </ScreenRenderErrorBoundary>
    );
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

export function useRegressionScenarioComponentAction(
  action: string,
  handler: () => void | Promise<void>,
) {
  const context = useContext(ScenarioContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const runId = context.active ? context.runId : null;

  useEffect(() => {
    if (!runId) {
      return;
    }
    return registerRegressionScenarioComponentAction(runId, action, () =>
      handlerRef.current(),
    );
  }, [action, runId]);
}

export function useRegressionScenarioAssertion(
  assertion: string,
  data: Readonly<Record<string, unknown>> | null,
) {
  const context = useContext(ScenarioContext);
  const dataRef = useRef(data);
  dataRef.current = data;
  const runId = context.active ? context.runId : null;
  const enabled = data !== null;

  useEffect(() => {
    if (
      !context.active ||
      context.runId !== runId ||
      !enabled ||
      !context.claimOnce(assertion)
    ) {
      return;
    }

    context.report('assertion', {
      ...(dataRef.current || {}),
      assertion,
      passed: true,
    });
  }, [assertion, context, enabled, runId]);
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
