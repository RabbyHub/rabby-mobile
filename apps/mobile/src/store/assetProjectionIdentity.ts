import type {
  AssetProjectionKind,
  AssetProjectionScene,
} from '@/databases/entities/assetProjection';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export type AssetProjectionIdentity = {
  kind: AssetProjectionKind;
  scene: AssetProjectionScene;
  runtimeKey: string;
};

export const buildAssetProjectionStorageKey = ({
  kind,
  scene,
  runtimeKey,
}: AssetProjectionIdentity) => {
  const identity = JSON.stringify([
    'asset-projection',
    2,
    kind,
    scene,
    runtimeKey,
  ]);
  return `ap:2:${bytesToHex(sha256(utf8ToBytes(identity)))}`;
};
