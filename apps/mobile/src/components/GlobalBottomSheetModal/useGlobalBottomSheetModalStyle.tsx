import { atom, useAtom } from 'jotai';
import { StyleProp, ViewStyle } from 'react-native';

const handleStyleAtom = atom<StyleProp<ViewStyle>>({});
export const useGlobalBottomSheetModalStyle = () => {
  const [handleStyle, setHandleStyle] = useAtom(handleStyleAtom);

  return {
    handleStyle,
    setHandleStyle,
  };
};
