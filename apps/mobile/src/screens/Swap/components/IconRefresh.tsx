import TouchableItem from '@/components/Touchable/TouchableItem';
import React, { memo } from 'react';
import RcSwapRefresh from '@/assets/icons/swap/refresh.svg';

export const IconRefresh = memo((props: { onPress: () => void }) => {
  const { onPress } = props;

  return (
    <TouchableItem onPress={onPress}>
      <RcSwapRefresh width={16} height={16} />
    </TouchableItem>
  );
});
