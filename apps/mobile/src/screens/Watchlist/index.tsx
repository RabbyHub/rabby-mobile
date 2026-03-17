import React from 'react';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { WatchlistContent } from './WatchlistContent';

function WatchlistScreen(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      noHeader
      overwriteStyle={styles.overwriteStyle}>
      <WatchlistContent />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  overwriteStyle: {
    position: 'relative',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
}));

export default WatchlistScreen;
