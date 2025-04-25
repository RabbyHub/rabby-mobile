import { ListRenderItem, View } from 'react-native';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';
import { ListItemAsset } from './ListItemAsset';

export const ListItem: ListRenderItem<AssetApprovalSpenderWithStatus> = ({
  item,
}) => {
  return (
    <View>
      <ListItemAsset data={item} />
      <View></View>
    </View>
  );
};
