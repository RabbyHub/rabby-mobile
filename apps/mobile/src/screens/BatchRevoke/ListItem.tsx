import { View } from 'react-native';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';
import { ListItemAsset } from './ListItemAsset';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { ListItemSpender } from './ListItemSpender';
import { ListItemStatus } from './ListItemStatus';
import React from 'react';
import { CELL_WIDTH } from './Cell';

export const ListItem: React.FC<{
  item: AssetApprovalSpenderWithStatus;
  isPaused: boolean;
  onStillRevoke: (record: AssetApprovalSpenderWithStatus) => void;
}> = ({ item, isPaused, onStillRevoke }) => {
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <View style={styles.root}>
      <View style={styles.asset}>
        <ListItemAsset data={item} />
      </View>
      <View style={styles.revokeFrom}>
        <ListItemSpender data={item} />
      </View>
      <View style={styles.gasFee}>
        <ListItemStatus
          data={item}
          isPaused={isPaused}
          onStillRevoke={() => onStillRevoke(item)}
        />
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  asset: {
    width: CELL_WIDTH.ASSET,
  },
  revokeFrom: {
    width: CELL_WIDTH.REVOKE_FROM,
  },
  gasFee: {
    width: CELL_WIDTH.GAS_FEE,
  },
  headerText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
}));
