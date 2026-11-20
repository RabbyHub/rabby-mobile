import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useFocusedTab } from 'react-native-collapsible-tab-view';
import { useMaybeCollapsibleScene } from '@rabby-wallet/rn-collapsible-scene-view';

import RefreshNudgedTickerText from './RefreshNudgedTickerText';

type Props = React.ComponentProps<typeof RefreshNudgedTickerText> & {
  tabName: string;
};

type TickerProps = Props & { focusedTab: string | undefined };

const FocusedTickerText = ({
  focusedTab,
  tabName,
  active = true,
  ...props
}: TickerProps) => {
  const isScreenFocused = useIsFocused();

  // Observe focus at this leaf even when parents are render-gated. Keep the
  // ticker and its measured glyph layout mounted during transitions, releasing
  // only the hidden rolling digit trees.
  return (
    <RefreshNudgedTickerText
      {...props}
      active={active && isScreenFocused && focusedTab === tabName}
    />
  );
};

/** Leaf that reads the tab focus from the legacy collapsible-tab-view host. */
const LegacyTabTicker = (props: Props) => {
  const focusedTab = useFocusedTab();
  return <FocusedTickerText {...props} focusedTab={focusedTab} />;
};

/** Leaf that reads the tab focus from the home scene pager. */
const SceneTabTicker = (props: Props) => {
  const scene = useMaybeCollapsibleScene();
  return <FocusedTickerText {...props} focusedTab={scene?.activeTab} />;
};

const TabFocusedTickerText = ({
  tabName,
  animate = true,
  active = true,
  ...props
}: Props) => {
  const scene = useMaybeCollapsibleScene();
  const nextProps = { ...props, active, animate, tabName };
  return scene ? (
    <SceneTabTicker {...nextProps} />
  ) : (
    <LegacyTabTicker {...nextProps} />
  );
};

export default React.memo(TabFocusedTickerText);
