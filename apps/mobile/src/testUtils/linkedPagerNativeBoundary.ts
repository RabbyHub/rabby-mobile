import React from 'react';
// eslint-disable-next-line no-restricted-imports -- External native boundary, not product UI.
import * as Native from 'react-native';

/** Test execution boundary only: production model, renderer and Stores stay real.
 * Timing is deliberately deferred until the shared-value assignment completes.
 * This is not a simulation of UIKit/Android recognizer arbitration or frame time.
 */
export type PanEvent = {
  translationX: number;
  translationY: number;
  velocityX: number;
  x: number;
  y: number;
  absoluteX: number;
  absoluteY: number;
};
export type PanManager = {
  fail: jest.Mock;
  activate: jest.Mock;
  end: jest.Mock;
};
export type PanBoundary = {
  config: Record<string, unknown>;
  handlers: Record<string, (event: PanEvent, success?: boolean) => void>;
  touchesDown?: (
    event: {
      allTouches: Array<{ x: number; y: number }>;
      numberOfTouches: number;
    },
    manager: PanManager,
  ) => void;
};

type SharedCell = {
  value: unknown;
  read: () => unknown;
  write: (value: unknown) => void;
  listeners: Set<Reaction>;
};
type Animation = {
  kind: 'linked-pager-boundary-timing';
  target: number;
  callback?: (finished: boolean, current?: number) => void;
};
export type PendingAnimation = Animation & {
  cell: SharedCell;
  from: number;
  cancelled: boolean;
  finished: boolean;
};
type Reaction = {
  dependencies: Set<SharedCell>;
  run: () => void;
};

let collecting: Set<SharedCell> | undefined;
const cells = new Set<SharedCell>();
const tasks: PendingAnimation[] = [];
const reactions = new Set<Reaction>();
const pans: PanBoundary[] = [];
const jsNotifications: Array<() => void> = [];
let deferJSNotifications = false;
const activeAnimation = (cell: SharedCell) =>
  tasks.find(task => task.cell === cell && !task.cancelled && !task.finished);
const isAnimation = (value: unknown): value is Animation =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'linked-pager-boundary-timing';
const cancel = (cell: SharedCell) => {
  const task = activeAnimation(cell);
  if (task) {
    task.cancelled = true;
    task.callback?.(false, Number(cell.read()));
  }
};

function shared(value: unknown): SharedCell {
  let current = value;
  const cell: SharedCell = {
    get value() {
      collecting?.add(cell);
      return current;
    },
    set value(next) {
      cancel(cell);
      if (isAnimation(next)) {
        tasks.push({
          ...next,
          cell,
          from: Number(current),
          cancelled: false,
          finished: false,
        });
      } else {
        cell.write(next);
      }
    },
    read: () => current,
    write: next => {
      if (Object.is(next, current)) {
        return;
      }
      current = next;
      for (const reaction of [...cell.listeners]) {
        reaction.run();
      }
    },
    listeners: new Set(),
  };
  cells.add(cell);
  return cell;
}

export const nativeBoundary = {
  pans,
  scrollTo: jest.fn(),
  latestPan: () => pans[pans.length - 1],
  animations: () => tasks.filter(task => !task.cancelled && !task.finished),
  animationHistory: () => [...tasks],
  sharedValues: () => [...cells],
  // A deterministic notification-ordering model, not a second JS runtime.
  // Existing tests keep synchronous delivery; latency-sensitive contracts
  // explicitly defer runOnJS and observe UI state before flushing this FIFO.
  setJSNotificationsDeferred: (deferred: boolean) => {
    deferJSNotifications = deferred;
  },
  pendingJSCount: () => jsNotifications.length,
  flushNextJS: () => {
    const next = jsNotifications.shift();
    if (!next) {
      throw new Error('No pending UI-to-JS notification');
    }
    next();
  },
  flushJS: () => {
    let count = 0;
    while (jsNotifications.length > 0) {
      if (++count > 1000) {
        throw new Error('UI-to-JS notification boundary did not converge');
      }
      jsNotifications.shift()?.();
    }
  },
  advanceAnimations: (fraction: number) => {
    for (const task of nativeBoundary.animations()) {
      task.cell.write(task.from + (task.target - task.from) * fraction);
    }
  },
  finishNextAnimation: () => {
    const task = nativeBoundary.animations()[0];
    if (!task) {
      throw new Error('No pending UI animation');
    }
    // A completion may install the next animation; never overwrite it later.
    task.finished = true;
    task.cell.write(task.target);
    task.callback?.(true, task.target);
  },
  finishAnimations: () => {
    let count = 0;
    while (nativeBoundary.animations().length > 0) {
      if (++count > 50) {
        throw new Error('UI animation boundary did not converge');
      }
      nativeBoundary.finishNextAnimation();
    }
  },
  reset: () => {
    jsNotifications.length = 0;
    deferJSNotifications = false;
    tasks.length = 0;
    pans.length = 0;
    for (const cell of cells) {
      cell.listeners.clear();
    }
    cells.clear();
    reactions.clear();
    collecting = undefined;
    nativeBoundary.scrollTo.mockClear();
  },
};

export function createGestureBoundary() {
  const pan = () => {
    const boundary: PanBoundary & Record<string, unknown> = {
      config: {},
      handlers: {},
    };
    for (const name of [
      'enabled',
      'activeOffsetX',
      'failOffsetY',
      'maxPointers',
      'minDistance',
      'runOnJS',
      'withTestId',
      'shouldCancelWhenOutside',
    ]) {
      boundary[name] = (value: unknown) => {
        boundary.config[name] = value;
        return boundary;
      };
    }
    for (const name of [
      'onBegin',
      'onStart',
      'onUpdate',
      'onEnd',
      'onFinalize',
    ]) {
      boundary[name] = (handler: PanBoundary['handlers'][string]) => {
        boundary.handlers[name] = handler;
        return boundary;
      };
    }
    boundary.onTouchesDown = (handler: PanBoundary['touchesDown']) => {
      boundary.touchesDown = handler;
      return boundary;
    };
    pans.push(boundary);
    return boundary;
  };
  return {
    Pressable: Native.Pressable,
    Text: Native.Text,
    TextInput: Native.TextInput,
    Gesture: { Pan: pan },
    GestureDetector: ({
      children,
      gesture,
    }: React.PropsWithChildren<{ gesture: PanBoundary }>) =>
      React.createElement(
        Native.View,
        {
          testID: String(gesture.config.withTestId ?? 'native-pan-boundary'),
          gesture,
        } as Native.ViewProps,
        children,
      ),
  };
}

export function createReanimatedBoundary() {
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: unknown) => component,
      View: Native.View,
      ScrollView: Native.ScrollView,
    },
    useSharedValue: (value: unknown) => {
      const ref = React.useRef<SharedCell | null>(null);
      if (!ref.current) {
        ref.current = shared(value);
      }
      return ref.current;
    },
    // Keep the public read-only derived value live without making React own
    // animation frames. Reads still collect the backing shared-cell dependency.
    useDerivedValue: <Value>(updater: () => Value) => {
      const current = React.useRef(updater);
      current.current = updater;
      return React.useMemo(
        () => ({
          get value() {
            return current.current();
          },
        }),
        [],
      );
    },
    useAnimatedStyle: (style: () => Record<string, unknown>) =>
      new Proxy(
        {},
        {
          ownKeys: () => Object.keys(style()),
          getOwnPropertyDescriptor: () => ({
            configurable: true,
            enumerable: true,
          }),
          get: (_target, key) => style()[String(key)],
        },
      ),
    useAnimatedRef: () =>
      React.useMemo(() => {
        const ref = (instance: unknown) => {
          ref.current = instance;
        };
        ref.current = null as unknown;
        return ref;
      }, []),
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (current: unknown, previous: unknown) => void,
      dependencies: React.DependencyList = [],
    ) => {
      React.useEffect(() => {
        let previous: unknown = null;
        let running = false;
        const reaction: Reaction = {
          dependencies: new Set(),
          run: () => {
            if (running) {
              return;
            }
            running = true;
            const priorCollector = collecting;
            collecting = new Set();
            const next = prepare();
            for (const cell of reaction.dependencies) {
              cell.listeners.delete(reaction);
            }
            reaction.dependencies = collecting;
            collecting = priorCollector;
            for (const cell of reaction.dependencies) {
              cell.listeners.add(reaction);
            }
            const before = previous;
            previous = next;
            react(next, before);
            running = false;
          },
        };
        reactions.add(reaction);
        reaction.run();
        return () => {
          reactions.delete(reaction);
          for (const cell of reaction.dependencies) {
            cell.listeners.delete(reaction);
          }
        };
        // Reanimated accepts the worklet dependency list at its external API.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, dependencies);
    },
    useAnimatedScrollHandler:
      (handlers: Record<string, (event: unknown) => void>) =>
      (event: { nativeEvent: unknown; eventName?: string }) =>
        handlers[event.eventName ?? 'onScroll']?.(event.nativeEvent),
    useEvent: (handler: unknown) => handler,
    runOnUI: (callback: unknown) => callback,
    runOnJS:
      <Args extends unknown[]>(callback: (...args: Args) => unknown) =>
      (...args: Args) => {
        if (deferJSNotifications) {
          jsNotifications.push(() => callback(...args));
        } else {
          callback(...args);
        }
      },
    cancelAnimation: (cell: SharedCell) => cancel(cell),
    withTiming: (
      target: number,
      _config: unknown,
      callback?: Animation['callback'],
    ): Animation => ({
      kind: 'linked-pager-boundary-timing',
      target,
      callback,
    }),
    Easing: {
      linear: (value: number) => value,
      quad: (value: number) => value * value,
      cubic: (value: number) => value * value * value,
      out: (easing: (value: number) => number) => (value: number) =>
        1 - easing(1 - value),
      inOut: (easing: (value: number) => number) => easing,
    },
    scrollTo: (...args: unknown[]) => nativeBoundary.scrollTo(...args),
  };
}
