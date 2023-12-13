import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

type Theme = 'light' | 'dark' | 'system';

const ThemeStore = atomWithStorage(
  'Theme',
  'light',
  createJSONStorage<Theme>(() => AsyncStorage),
);

export function useTheme() {
  const [theme, setTheme] = useAtom(ThemeStore);

  return { theme, setTheme };
}
