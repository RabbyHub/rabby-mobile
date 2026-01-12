import { zCreate } from '@/core/utils/reexports';
import { makeMutable } from 'react-native-reanimated';
import { Mutable } from 'react-native-reanimated/lib/typescript/commonTypes';

export const useHomeDrawerAnimateStore = zCreate<{
  tabsOpacity: Mutable<number>;
}>(() => ({
  tabsOpacity: makeMutable(0),
}));
