import { ReserveDataHumanized } from '@aave/contract-helpers';
import {
  FormatReserveUSDResponse,
  FormatUserSummaryAndIncentivesResponse,
} from '@aave/math-utils';
import { FormattedReserveEMode } from '@aave/math-utils/dist/esm/formatters/emode';

export function assetCanBeBorrowedByUser(
  {
    borrowingEnabled,
    isActive,
    borrowableInIsolation,
    isFrozen,
    isPaused,
  }: ReserveDataHumanized,
  user: FormatUserSummaryAndIncentivesResponse<
    ReserveDataHumanized & FormatReserveUSDResponse
  >,
  eModes: FormattedReserveEMode[],
) {
  const isInEmode = user.userEmodeCategoryId !== 0;
  if (!borrowingEnabled || !isActive || isFrozen || isPaused) {
    return false;
  }
  if (isInEmode) {
    const reserveEmode = eModes.find(
      emode => emode.id === user.userEmodeCategoryId,
    );
    if (!reserveEmode) {
      return false;
    }
    return reserveEmode.borrowingEnabled;
  }
  if (user?.isInIsolationMode && !borrowableInIsolation) {
    return false;
  }
  return true;
}
