import { isEqual } from 'lodash';
import { shallow } from 'zustand/shallow';
import type { PerpsState, PositionAndOpenOrder } from './usePerpsStore';

type DisplaySource = Pick<
  PerpsState,
  | 'isInitialized'
  | 'isLogin'
  | 'hasPermission'
  | 'currentClearinghouseState'
  | 'openOrders'
>;

export type PerpsSimpleDisplayState = Pick<
  PerpsState,
  'isInitialized' | 'isLogin' | 'hasPermission'
> & { positionAndOpenOrders: PositionAndOpenOrder[] };

const EMPTY_POSITIONS: PositionAndOpenOrder[] = [];

/** Per-consumer cache: preserve every position/order field and source order. */
export function createPerpsSimpleDisplaySelector() {
  let previousPositions:
    | NonNullable<DisplaySource['currentClearinghouseState']>['assetPositions']
    | undefined;
  let previousOrders: DisplaySource['openOrders'] | undefined;
  let rows = EMPTY_POSITIONS;
  let snapshot: PerpsSimpleDisplayState | undefined;

  return (state: DisplaySource): PerpsSimpleDisplayState => {
    const positions = state.currentClearinghouseState?.assetPositions;
    if (!positions?.length) {
      rows = EMPTY_POSITIONS;
    } else if (
      positions !== previousPositions ||
      state.openOrders !== previousOrders
    ) {
      const ordersByCoin = new Map<string, PerpsState['openOrders']>();
      for (const order of state.openOrders) {
        const coinOrders = ordersByCoin.get(order.coin);
        if (coinOrders) {
          coinOrders.push(order);
        } else {
          ordersByCoin.set(order.coin, [order]);
        }
      }
      const next = positions.map((position, index) => {
        const row = {
          ...position,
          openOrders: ordersByCoin.get(position.position.coin) || [],
        };
        // Do not compare a hand-picked field list: risk, leverage, nested
        // orders and future SDK fields must all invalidate the display.
        return isEqual(rows[index], row) ? rows[index] : row;
      });
      if (!shallow(rows, next)) {
        rows = next;
      }
    }
    previousPositions = positions;
    previousOrders = state.openOrders;
    const nextSnapshot = {
      isInitialized: state.isInitialized,
      isLogin: state.isLogin,
      hasPermission: state.hasPermission,
      positionAndOpenOrders: rows,
    };
    if (!snapshot || !shallow(snapshot, nextSnapshot)) {
      snapshot = nextSnapshot;
    }
    return snapshot;
  };
}

/** Legacy consumers retain their existing broad presentation and join. */
export function createPerpsLegacyDisplaySelector() {
  let previousClearinghouse:
    | PerpsState['currentClearinghouseState']
    | undefined;
  let positions: NonNullable<
    PerpsState['currentClearinghouseState']
  >['assetPositions'] = [];
  let previousPositions = positions;
  let previousOrders: PerpsState['openOrders'] | undefined;
  let rows: PositionAndOpenOrder[] = [];
  return (
    state: DisplaySource &
      Pick<
        PerpsState,
        | 'perpFee'
        | 'userFills'
        | 'userAccountHistory'
        | 'localLoadingHistory'
        | 'favoriteMarkets'
      >,
  ) => {
    if (previousClearinghouse !== state.currentClearinghouseState) {
      positions = state.currentClearinghouseState?.assetPositions || [];
      previousClearinghouse = state.currentClearinghouseState;
    }
    if (
      previousPositions !== positions ||
      previousOrders !== state.openOrders
    ) {
      rows = positions.map(position => ({
        ...position,
        openOrders: state.openOrders.filter(
          order => order.coin === position.position.coin,
        ),
      }));
      previousPositions = positions;
      previousOrders = state.openOrders;
    }
    return {
      isInitialized: state.isInitialized,
      isLogin: state.isLogin,
      hasPermission: state.hasPermission,
      perpFee: state.perpFee,
      userFills: state.userFills,
      userAccountHistory: state.userAccountHistory,
      localLoadingHistory: state.localLoadingHistory,
      favoriteMarkets: state.favoriteMarkets,
      openOrders: state.openOrders,
      currentClearinghouseState: state.currentClearinghouseState,
      positionAndOpenOrders: rows,
    };
  };
}
