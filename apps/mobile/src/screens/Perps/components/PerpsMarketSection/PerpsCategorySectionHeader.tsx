import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { RcArrowRightCC } from '@/assets/icons/common';
import RcArrowRight2CC from '@/assets2024/icons/copyTrading/IconRrightArrowCC.svg';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import {
  PERPS_CATEGORY_MAP,
  PerpsCategoryId,
} from '../../constants/perpsCategories';

export const PerpsCategorySectionHeader: React.FC<{
  categoryId: PerpsCategoryId;
}> = ({ categoryId }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const cfg = PERPS_CATEGORY_MAP[categoryId];
  // Favorite is always fully displayed; no "see more" target.
  const handlePress = () => {
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.PerpsSearch,
      params: {
        initialTab: categoryId,
        openFromSource: 'searchPerps',
        autoFocus: false,
      },
    });
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.touchable}
        hitSlop={8}
        onPress={handlePress}>
        <Text style={styles.title}>{t(cfg.labelI18nKey)}</Text>
        <RcArrowRight2CC
          width={16}
          height={16}
          color={colors2024['neutral-title-1']}
        />
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    marginTop: 24,
    marginBottom: 4,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
}));
