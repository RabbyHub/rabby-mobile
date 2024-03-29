import React from 'react';
import { Text } from 'react-native';
import { useThemeStyles } from '@/hooks/theme';

import { createGetStyles } from '@/utils/styles';

import { NFTBadgeType } from '../utils';

export default function ApprovalNFTBadge({
  style,
  type,
}: RNViewProps & {
  type: NFTBadgeType;
}) {
  const { styles } = useThemeStyles(getNFTBadgeStyle);

  return (
    <Text
      style={[styles.nftTypeBadge, style]}
      ellipsizeMode="tail"
      numberOfLines={1}>
      {type === 'nft' ? 'NFT' : 'Collection'}
    </Text>
  );
}

const getNFTBadgeStyle = createGetStyles(colors => {
  return {
    nftTypeBadge: {
      borderRadius: 2,
      borderStyle: 'solid',
      borderColor: colors['neutral-line'],
      borderWidth: 0.5,
      paddingVertical: 1,
      paddingHorizontal: 4,
      fontSize: 12,
      fontWeight: '400',
      color: colors['neutral-foot'],
    },
  };
});
