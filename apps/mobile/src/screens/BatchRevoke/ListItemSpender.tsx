import React from 'react';
import { Text, View } from 'react-native';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';
import { AssetAvatar } from '@/components';

export const ListItemSpender: React.FC<{
  data: AssetApprovalSpenderWithStatus;
}> = ({ data }) => {
  const { $assetParent: asset } = data;

  if (!asset) {
    return null;
  }

  const protocolName = data.protocol?.name || 'Unknown';

  return (
    <View>
      <AssetAvatar
        chain={asset.chain}
        logo={asset.logo_url}
        size={24}
        chainSize={8}
        chainIconPosition="br"
      />
      <Text>{protocolName}</Text>
    </View>
  );
};
