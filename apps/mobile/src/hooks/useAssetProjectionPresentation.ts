import { useMemo } from 'react';

import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  resolveAssetProjectionPresentation,
  type AssetProjectionAvailability,
} from '@/store/assetProjectionAvailability';
import {
  buildAssetProjectionStorageKey,
  type AssetProjectionIdentity,
} from '@/store/assetProjectionIdentity';
import { useAssetReadModelStore } from '@/store/assetReadModel';

export const useAssetProjectionPresentation = ({
  identity,
  availability,
  hasData,
  hasSettledRequest,
  storeLabel,
}: {
  identity: AssetProjectionIdentity | null;
  availability: AssetProjectionAvailability;
  hasData: boolean;
  hasSettledRequest?: boolean;
  storeLabel: string;
}) => {
  const kind = identity?.kind;
  const scene = identity?.scene;
  const runtimeKey = identity?.runtimeKey;
  const storageKey = useMemo(
    () =>
      kind && scene && runtimeKey !== undefined
        ? buildAssetProjectionStorageKey({ kind, scene, runtimeKey })
        : null,
    [kind, runtimeKey, scene],
  );
  const readModel = useActivityStore(
    useAssetReadModelStore,
    state => (storageKey ? state.entries[storageKey] : undefined),
    Object.is,
    { storeLabel },
  );

  return resolveAssetProjectionPresentation({
    readModel,
    availability,
    hasData,
    hasSettledRequest,
  });
};
