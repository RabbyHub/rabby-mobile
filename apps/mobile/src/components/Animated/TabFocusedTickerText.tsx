import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useFocusedTab } from 'react-native-collapsible-tab-view';

import RefreshNudgedTickerText from './RefreshNudgedTickerText';

type Props = React.ComponentProps<typeof RefreshNudgedTickerText> & {
  tabName: string;
};

const TabFocusedTickerText = ({ tabName, animate = true, ...props }: Props) => {
  const focusedTab = useFocusedTab();
  const isScreenFocused = useIsFocused();

  // Observe focus at this leaf even when parents are render-gated. Keep the
  // ticker and its measured width mounted, releasing only hidden animated columns.
  return (
    <RefreshNudgedTickerText
      {...props}
      animate={animate && isScreenFocused && focusedTab === tabName}
    />
  );
};

export default React.memo(TabFocusedTickerText);
