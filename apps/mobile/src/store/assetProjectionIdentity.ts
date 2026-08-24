import type {
  AssetProjectionKind,
  AssetProjectionScene,
} from '@/databases/entities/assetProjection';

export type AssetProjectionIdentity = {
  kind: AssetProjectionKind;
  scene: AssetProjectionScene;
  runtimeKey: string;
};

export const buildAssetProjectionStorageKey = ({
  kind,
  scene,
  runtimeKey,
}: AssetProjectionIdentity) =>
  JSON.stringify(['asset-projection', 1, kind, scene, runtimeKey]);
