import { EmodeCategory, UserSummary } from '../type';
import { valueToBigNumber } from '@aave/math-utils';
import { FormattedReservesAndIncentives } from './apy';
import { fetchIconSymbolAndName } from './icon';

export const isEmodeEnabled = (
  user: Partial<Pick<UserSummary, 'userEmodeCategoryId'>>,
) => {
  return !!user?.userEmodeCategoryId && user.userEmodeCategoryId !== 0;
};

export const formatEmodes = (reserves: FormattedReservesAndIncentives[]) => {
  const eModes: Record<number, EmodeCategory> = {};

  reserves.forEach(r => {
    const { symbol, iconSymbol } = fetchIconSymbolAndName({
      underlyingAsset: r.underlyingAsset,
      symbol: r.symbol,
    });
    r.eModes.forEach(e => {
      if (!eModes[e.id]) {
        eModes[e.id] = {
          id: e.id,
          label: e.eMode.label,
          ltv: e.eMode.ltv,
          liquidationThreshold: e.eMode.liquidationThreshold,
          liquidationBonus: e.eMode.liquidationBonus,
          isolated: e.eMode.isolated,
          assets: [
            {
              underlyingAsset: r.underlyingAsset,
              symbol,
              iconSymbol,
              collateral: e.collateralEnabled,
              borrowable: e.borrowingEnabled,
              ltvzero: e.ltvzeroEnabled,
            },
          ],
        };
      } else {
        eModes[e.id]?.assets.push({
          underlyingAsset: r.underlyingAsset,
          symbol,
          iconSymbol,
          collateral: e.collateralEnabled,
          borrowable: e.borrowingEnabled,
          ltvzero: e.ltvzeroEnabled,
        });
      }
    });
  });

  // If all reserves have an eMode cateogry other than 0, we need to add the default empty one.
  // The UI assumes that there is always an eMode category 0, which is 'none'.
  if (!eModes[0]) {
    eModes[0] = {
      id: 0,
      label: '',
      liquidationBonus: '0',
      liquidationThreshold: '0',
      ltv: '0',
      isolated: false,
      assets: [],
    };
  }

  return eModes;
};

// An E-Mode category is available if the user's borrows and collateral are
// compatible with the target category.
export function isEModeCategoryAvailable(
  user: UserSummary,
  eMode: EmodeCategory,
  reserves: FormattedReservesAndIncentives[],
): boolean {
  const borrowableReserves = new Set(
    eMode.assets
      .filter(asset => asset.borrowable)
      .map(asset => asset.underlyingAsset),
  );

  const hasIncompatiblePositions = user.userReservesData.some(
    userReserve =>
      valueToBigNumber(userReserve.scaledVariableDebt).gt(0) &&
      !borrowableReserves.has(userReserve.reserve.underlyingAsset),
  );

  const reservesByAddress = new Map(
    reserves.map(reserve => [reserve.underlyingAsset, reserve]),
  );
  const hasIncompatibleCollateral = user.userReservesData.some(userReserve => {
    if (!userReserve.usageAsCollateralEnabledOnUser) {
      return false;
    }

    const reserve = reservesByAddress.get(userReserve.reserve.underlyingAsset);
    if (!reserve) {
      return false;
    }
    const reserveTargetEmode = reserve.eModes.find(
      entry => entry.id === eMode.id,
    );

    if (
      reserveTargetEmode?.collateralEnabled &&
      reserveTargetEmode.ltvzeroEnabled
    ) {
      return true;
    }

    if (!reserveTargetEmode?.collateralEnabled) {
      return (
        valueToBigNumber(reserve.baseLTVasCollateral).eq(0) || eMode.isolated
      );
    }

    return false;
  });

  return !hasIncompatiblePositions && !hasIncompatibleCollateral;
}
