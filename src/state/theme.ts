import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

type Theme = 'light' | 'dark' | 'system';

const ThemeStore = atomWithStorage(
  'Theme',
  'light',
  createJSONStorage<Theme>(() => AsyncStorage),
);

export const useSetTheme = () => useSetAtom(ThemeStore);

export const useGetTheme = () => useAtomValue(ThemeStore);
