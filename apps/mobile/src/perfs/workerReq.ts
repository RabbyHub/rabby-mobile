import {
  formatReserves,
  formatReservesAndIncentives,
  formatUserSummary,
  formatUserSummaryAndIncentives,
} from '@aave/math-utils';
import { rpcCallAndFallback } from './thread';

export async function worker_plus(a: number, b: number) {
  return rpcCallAndFallback(
    ctx => {
      return ctx.rpcCall('plus', {
        leftValue: a,
        rightValue: b,
      });
    },
    () => {
      // console.debug('[perf] worker_plus timeout fallback');
      return a + b;
    },
  );
}

export async function worker_formatReserves(
  input: Parameters<typeof import('@aave/math-utils').formatReserves>[0],
) {
  return rpcCallAndFallback(
    async ctx => {
      return ctx
        .rpcCall('formatReserves', {
          data: input,
        })
        .then(res => res?.result);
    },
    () => {
      // console.debug('[perf] worker_formatReserves timeout fallback');
      return formatReserves(input);
    },
  );
}

export async function worker_formatUserSummary(
  input: Parameters<typeof import('@aave/math-utils').formatUserSummary>[0],
) {
  return rpcCallAndFallback(
    async ctx => {
      return ctx
        .rpcCall('formatUserSummary', {
          data: input,
        })
        .then(res => res?.result);
    },
    () => {
      // console.debug('[perf] worker_formatUserSummary timeout fallback');
      return formatUserSummary(input);
    },
  );
}

export async function worker_formatReservesAndIncentives(
  input: Parameters<
    typeof import('@aave/math-utils').formatReservesAndIncentives
  >[0],
) {
  return rpcCallAndFallback(
    async ctx => {
      return ctx
        .rpcCall('formatReservesAndIncentives', {
          data: input,
        })
        .then(res => res?.result);
    },
    () => {
      // console.debug('[perf] worker_formatReservesAndIncentives timeout fallback');
      return formatReservesAndIncentives(input);
    },
  );
}

export async function worker_formatUserSummaryAndIncentives(
  input: Parameters<
    typeof import('@aave/math-utils').formatUserSummaryAndIncentives
  >[0],
) {
  return rpcCallAndFallback(
    async ctx => {
      return ctx
        .rpcCall('formatUserSummaryAndIncentives', {
          data: input,
        })
        .then(res => res?.result);
    },
    () => {
      // console.debug('[perf] worker_formatUserSummaryAndIncentives timeout fallback');
      return formatUserSummaryAndIncentives(input);
    },
  );
}
