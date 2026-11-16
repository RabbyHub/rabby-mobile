import RcIconEmptyDark from '@/assets2024/icons/perps/PerpsProHistoryEmptyDark.svg';
import RcIconEmpty from '@/assets2024/icons/perps/PerpsProHistoryEmpty.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export const PerpsHistoryEmpty = () => {
  const { t } = useTranslation();
  const { styles, isLight } = useTheme2024({ getStyle });
  const EmptyIllustration = isLight ? RcIconEmpty : RcIconEmptyDark;

  return (
    <View style={[styles.empty]}>
      <EmptyIllustration accessible={false} width={163} height={126} />
      <Text style={styles.message}>
        {t('page.perps.pro.history.noHistory')}
      </Text>
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  message: {
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
  },
}));
