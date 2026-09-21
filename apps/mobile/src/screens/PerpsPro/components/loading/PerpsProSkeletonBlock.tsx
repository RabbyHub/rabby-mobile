import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';

type PerpsProSkeletonBlockProps = React.ComponentProps<typeof CustomSkeleton>;

/**
 * Keeps the shared skeleton behavior while giving compact Perps Pro shapes a
 * token-backed base color that remains visible on their first rendered frame.
 */
export const PerpsProSkeletonBlock: React.FC<PerpsProSkeletonBlockProps> =
  React.memo(({ style, ...props }) => {
    const { styles } = useTheme2024({ getStyle });

    return (
      <CustomSkeleton
        {...props}
        animation="none"
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
