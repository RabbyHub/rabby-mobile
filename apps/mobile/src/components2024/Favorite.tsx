import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const Favorite = ({
  favorite,
  handlePressFavorite,
  style,
}: {
  favorite: boolean;
  handlePressFavorite: () => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors2024 } = useTheme2024();
  return (
    <Pressable
      style={style}
      onPress={e => {
        e.stopPropagation();
        handlePressFavorite();
      }}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
      <RcIconFavorite
        width={22}
        height={21}
        color={
          favorite ? colors2024['orange-default'] : colors2024['neutral-line']
        }
      />
    </Pressable>
  );
};

export const FavoriteTag = ({ style }: { style?: StyleProp<ViewStyle> }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.favoriteTag, style]}>
      <RcIconFavorite
        width={13}
        height={12}
        color={colors2024['orange-default']}
      />
    </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    favoriteTag: {
      backgroundColor: colors2024['orange-light-1'],
      width: 34.6,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 16,
    },
  };
});
