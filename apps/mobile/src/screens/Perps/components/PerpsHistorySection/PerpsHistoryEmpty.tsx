import RcIconEmptyDark from '@/assets2024/icons/perps/PerpsProHistoryEmptyDark.svg';
import RcIconEmpty from '@/assets2024/icons/perps/PerpsProHistoryEmpty.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

export const PerpsHistoryEmpty = () => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const EmptyIllustration = isLight ? RcIconEmpty : RcIconEmptyDark;

  return (
    <View style={[styles.empty]}>
      <EmptyIllustration accessible={false} width={163} height={126} />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  empty: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
}));
