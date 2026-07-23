import { shallow } from 'zustand/shallow';

export type PerpsStateUpdater<State extends object> = (prev: State) => State;

export function applyPerpsStateUpdate<State extends object>(
  prev: State,
  updater: PerpsStateUpdater<State>,
): State {
  const next = updater(prev);
  return shallow(prev, next) ? prev : next;
}
