import type { CurvePoint } from '@/store/curveShared';
import {
  areHomeProjectionActivitiesEqual,
  areHomeProjectionAddressListsEqual,
  buildHomeProjectionActivity,
  getHomeSelectionSignature,
  type HomeAccountProjection,
  type HomeProjectionActivity,
  type HomeProjectionAvailability,
  type HomeProjectionResourceFlow,
} from './model';

export type HomeCurveProjection = {
  availability: HomeProjectionAvailability;
  selectionSignature: string;
  selectionGeneration: number;
  sourceAddresses: string[];
  missingAddresses: string[];
  value?: {
    list: CurvePoint[];
  };
  activity: HomeProjectionActivity;
};

export type HomeCurveProjectionInput = {
  account: HomeAccountProjection;
  sceneAddresses: string[];
  list: CurvePoint[];
  curveValueMap: Record<
    string,
    Array<{ timestamp: number; usd_value: number }> | undefined
  >;
  flowMap?: Record<string, HomeProjectionResourceFlow | undefined>;
  isSceneLoading: boolean;
  isSceneComputing: boolean;
};

export function buildHomeCurveProjection(
  input: HomeCurveProjectionInput,
): HomeCurveProjection {
  const { account } = input;
  const isSceneMatched =
    getHomeSelectionSignature(input.sceneAddresses) ===
    account.selectionSignature;
  const sourceAddresses = account.addresses.filter(
    address => !!input.curveValueMap[address]?.length,
  );
  const missingAddresses = account.addresses.filter(
    address => !input.curveValueMap[address]?.length,
  );
  const activity = buildHomeProjectionActivity(
    account.addresses,
    [input.flowMap],
    isSceneMatched && input.isSceneComputing,
  );
  const isSceneActive =
    isSceneMatched && (input.isSceneLoading || input.isSceneComputing);
  let availability: HomeProjectionAvailability;

  if (account.availability === 'unresolved') {
    availability = 'unresolved';
  } else if (!account.addresses.length) {
    availability = 'empty';
  } else if (!isSceneMatched || isSceneActive) {
    availability = 'loading';
  } else if (!input.list.length) {
    availability = 'empty';
  } else if (
    account.availability === 'partial' ||
    missingAddresses.length > 0
  ) {
    availability = 'partial';
  } else {
    availability = 'ready';
  }

  return {
    availability,
    selectionSignature: account.selectionSignature,
    selectionGeneration: account.selectionGeneration,
    sourceAddresses,
    missingAddresses,
    value: isSceneMatched ? { list: input.list } : undefined,
    activity: {
      ...activity,
      isFetchingRemote:
        activity.isFetchingRemote || (isSceneMatched && input.isSceneLoading),
      isActive: activity.isActive || isSceneActive,
    },
  };
}

function areCurveListsEqual(left: CurvePoint[], right: CurvePoint[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const nextItem = right[index];
      return (
        !!nextItem &&
        item.timestamp === nextItem.timestamp &&
        item.value === nextItem.value &&
        item.rawChange === nextItem.rawChange &&
        item.changePercent === nextItem.changePercent &&
        item.isLoss === nextItem.isLoss
      );
    })
  );
}

export function areHomeCurveProjectionsEqual(
  previous: HomeCurveProjection,
  next: HomeCurveProjection,
) {
  return (
    previous.availability === next.availability &&
    previous.selectionSignature === next.selectionSignature &&
    previous.selectionGeneration === next.selectionGeneration &&
    areHomeProjectionAddressListsEqual(
      previous.sourceAddresses,
      next.sourceAddresses,
    ) &&
    areHomeProjectionAddressListsEqual(
      previous.missingAddresses,
      next.missingAddresses,
    ) &&
    areCurveListsEqual(previous.value?.list || [], next.value?.list || []) &&
    areHomeProjectionActivitiesEqual(previous.activity, next.activity)
  );
}
