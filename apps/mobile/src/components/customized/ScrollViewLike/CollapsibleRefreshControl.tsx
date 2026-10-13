import React from 'react';
import {
  Platform,
  RefreshControl,
  type RefreshControlProps,
} from 'react-native';

type Props = RefreshControlProps & {
  as?: React.ElementType<RefreshControlProps & React.RefAttributes<any>>;
};

/** Only for lists whose content inset is owned by collapsible-tab-view. */
export const CollapsibleRefreshControl = React.forwardRef<
  RefreshControl,
  Props
>(({ as: Component = RefreshControl, progressViewOffset, ...props }, ref) => {
  const usesFabric = !!(
    global as typeof global & { nativeFabricUIManager?: object }
  ).nativeFabricUIManager;

  return (
    <Component
      {...props}
      ref={ref}
      // Tabs clones this element with its header height as progressViewOffset.
      // UIKit already positions the control below contentInset.top. Fabric
      // translates its bounds again, unlike Paper's parent-space conversion.
      // Apply the correction here, after Tabs has injected its props.
      progressViewOffset={
        Platform.OS === 'ios' && usesFabric ? 0 : progressViewOffset
      }
    />
  );
});

CollapsibleRefreshControl.displayName = 'CollapsibleRefreshControl';
