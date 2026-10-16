import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useFocusedTab } from 'react-native-collapsible-tab-view';

import RefreshNudgedTickerText from './RefreshNudgedTickerText';

type Props = React.ComponentProps<typeof RefreshNudgedTickerText> & {
  tabName: string;
};

const TabFocusedTickerText = ({
  tabName,
  animate = true,
  active = true,
  ...props
}: Props) => {
  const focusedTab = useFocusedTab();
  const isScreenFocused = useIsFocused();

  // Observe focus at this leaf even when parents are render-gated. Keep the
  // ticker and its measured glyph layout mounted during transitions, releasing
  // only the hidden rolling digit trees.
  return (
    <RefreshNudgedTickerText
      {...props}
      animate={animate}
      active={active && isScreenFocused && focusedTab === tabName}
    />
  );
};

export default React.memo(TabFocusedTickerText);
