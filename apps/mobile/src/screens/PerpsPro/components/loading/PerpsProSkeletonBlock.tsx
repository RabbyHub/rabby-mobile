import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useSyncExternalStore } from 'react';

type PerpsProSkeletonBlockProps = Omit<
  React.ComponentProps<typeof CustomSkeleton>,
  'pulseEnabled'
>;

/**
 * Keeps the shared skeleton behavior while giving compact Perps Pro shapes a
 * token-backed base color that remains visible on their first rendered frame.
 */
export const PerpsProSkeletonBlock: React.FC<PerpsProSkeletonBlockProps> =
  React.memo(({ style, ...props }) => {
    const { styles } = useTheme2024({ getStyle });
    const activityScope = useStoreActivityScope();
    const pulseEnabled = useSyncExternalStore(
      activityScope.subscribe,
      activityScope.getActive,
      activityScope.getActive,
    );

    return (
      <CustomSkeleton
        {...props}
        animation="none"
        pulseEnabled={pulseEnabled}
        style={[styles.visibleBase, style]}
      />
    );
  });

PerpsProSkeletonBlock.displayName = 'PerpsProSkeletonBlock';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  visibleBase: {
    backgroundColor: colors2024['neutral-info'],
  },
}));
