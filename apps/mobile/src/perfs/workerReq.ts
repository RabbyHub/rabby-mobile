import { workerThread } from './thread';

export async function worker_plus(a: number, b: number) {
  return workerThread.remoteCall('plus', {
    leftValue: a,
    rightValue: b,
  });
}

export async function worker_formatReserves(
  input: Parameters<typeof import('@aave/math-utils').formatReserves>[0],
) {
  return workerThread
    .remoteCall('formatReserves', {
      data: input,
    })
    .then(res => res?.result);
}

export async function worker_formatUserSummary(
  input: Parameters<typeof import('@aave/math-utils').formatUserSummary>[0],
) {
  return workerThread
    .remoteCall('formatUserSummary', {
      data: input,
    })
    .then(res => res?.result);
}

export async function worker_formatReservesAndIncentives(
  input: Parameters<
    typeof import('@aave/math-utils').formatReservesAndIncentives
  >[0],
) {
  return workerThread
    .remoteCall('formatReservesAndIncentives', {
      data: input,
    })
    .then(res => res?.result);
}

export async function worker_formatUserSummaryAndIncentives(
  input: Parameters<
    typeof import('@aave/math-utils').formatUserSummaryAndIncentives
  >[0],
) {
  return workerThread
    .remoteCall('formatUserSummaryAndIncentives', {
      data: input,
    })
    .then(res => res?.result);
}
