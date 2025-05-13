import React from 'react';
import { stringUtils } from '@rabby-wallet/base-utils';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';
import { AssetAvatar } from '@/components';
import { Cell, CellText } from './Cell';

const { ensureSuffix } = stringUtils;

export const ListItemAsset: React.FC<{
  data: AssetApprovalSpenderWithStatus;
}> = ({ data }) => {
  const { $assetParent: asset } = data;

  if (!asset) {
    return null;
  }

  const fullName =
    asset.type === 'nft' && asset.nftToken
      ? ensureSuffix(asset.name || 'Unknown', ` #${asset.nftToken.inner_id}`)
      : asset.name || 'Unknown';

  return (
    <Cell>
      <AssetAvatar logo={asset.logo_url} />
      <CellText>{fullName}</CellText>
    </Cell>
  );
};
