import { Pressable, StyleProp, ViewStyle } from 'react-native';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useTheme2024 } from '@/hooks/theme';

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
