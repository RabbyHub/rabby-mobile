import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcArrowRight2CC from '@/assets2024/icons/copyTrading/IconRrightArrowCC.svg';
import RcIconSearchCC from '@/assets2024/icons/perps/IconSearchCC.svg';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { PerpsCategoryConfig } from '../../constants/perpsCategories';

export const PerpsCategorySectionHeader: React.FC<{
  cfg: PerpsCategoryConfig;
  showSearch?: boolean;
}> = ({ cfg, showSearch }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const handlePress = () => {
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.PerpsSearch,
      params: {
        initialTab: cfg.id,
        openFromSource: 'searchPerps',
        autoFocus: false,
      },
    });
  };

  const handleSearchPress = () => {
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.PerpsSearch,
      params: {
        openFromSource: 'searchPerps',
        autoFocus: true,
        initialTab: 'topVolume',
      },
    });
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.touchable}
        hitSlop={8}
        onPress={handlePress}>
        <Text style={styles.title}>{cfg.label}</Text>
        <RcArrowRight2CC
          width={16}
          height={16}
          color={colors2024['neutral-title-1']}
        />
      </TouchableOpacity>
      {showSearch ? (
        <TouchableOpacity hitSlop={8} onPress={handleSearchPress}>
          <RcIconSearchCC
            width={20}
            height={20}
            color={colors2024['neutral-foot']}
          />
        </TouchableOpacity>
      ) : null}
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
    justifyContent: 'space-between',
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
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
