import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import RcIconRightCC from '@/assets/icons/common/arrow-right-cc.svg';
import { Text } from '@/components/Typography';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';

/** Card on the Perps home that opens the Hyperliquid spot markets. */
export const PerpsSpotEntry: React.FC = React.memo(() => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const handlePress = useCallback(() => {
    naviPush(RootNames.StackTransaction, { screen: RootNames.PerpsSpot });
  }, []);

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.texts}>
        <Text style={styles.title}>{t('page.perpsSpot.entry')}</Text>
        <Text style={styles.desc}>{t('page.perpsSpot.entryDesc')}</Text>
      </View>
      <RcIconRightCC
        width={16}
        height={16}
        color={colors2024['neutral-foot']}
      />
    </TouchableOpacity>
  );
});

// Matches the PerpsMarketHomeList card surface right below it.
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-5'],
    backgroundColor: isLight
      ? 'rgba(255, 255, 255, 0.9)'
      : colors2024['neutral-bg-2'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  texts: { gap: 2, flex: 1 },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
}));
