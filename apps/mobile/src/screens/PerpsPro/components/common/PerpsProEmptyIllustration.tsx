import EmptyDark from '@/assets2024/icons/perps/PerpsProEmptyDark.svg';
import EmptyLight from '@/assets2024/icons/perps/PerpsProEmptyLight.svg';
import React from 'react';

export const PerpsProEmptyIllustration = React.memo(
  ({ isLight, testID }: { isLight: boolean; testID: string }) => {
    const Illustration = isLight ? EmptyLight : EmptyDark;
    return (
      <Illustration
        accessible={false}
        height={126}
        width={163}
        testID={testID}
      />
    );
  },
);

PerpsProEmptyIllustration.displayName = 'PerpsProEmptyIllustration';
