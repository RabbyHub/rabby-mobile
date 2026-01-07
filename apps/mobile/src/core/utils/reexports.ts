import { getDefaultStore } from 'jotai';

export { create as zCreate } from 'zustand';

export {
  persist as zPersist,
  createJSONStorage as zCreateJSONStorage,
} from 'zustand/middleware';

export { mutative as zMutative } from 'zustand-mutative';

export { create as mCreate } from 'mutative';

export const jotaiStore = getDefaultStore();

export { type ReactNativeDriver } from 'typeorm/browser/driver/react-native/ReactNativeDriver';
