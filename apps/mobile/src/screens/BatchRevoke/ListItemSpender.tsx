import React from 'react';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';
import { AssetAvatar } from '@/components';
import { Cell, CellText } from './Cell';

export const ListItemSpender: React.FC<{
  data: AssetApprovalSpenderWithStatus;
}> = ({ data }) => {
  const { $assetParent: asset } = data;

  if (!asset) {
    return null;
  }

  const protocolName = data.protocol?.name || 'Unknown';

  return (
    <Cell>
      <AssetAvatar
        chain={asset.chain}
        logo={data.protocol?.logo_url}
        size={24}
        chainSize={8}
        chainIconPosition="br"
      />
      <CellText>{protocolName}</CellText>
    </Cell>
  );
};
