import React from 'react';
import { Text, View } from 'react-native';
import { stringUtils } from '@rabby-wallet/base-utils';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';

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
    <View>
      <ChainIconImage chainServerId={asset.chain} />
      <Text>{fullName}</Text>
    </View>
  );
};
