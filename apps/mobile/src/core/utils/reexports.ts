import { getDefaultStore } from 'jotai';

export { create as zCreate, useStore as zUseStore } from 'zustand';

export {
  persist as zPersist,
  createJSONStorage as zCreateJSONStorage,
} from 'zustand/middleware';

export { mutative as zMutative } from 'zustand-mutative';

export { create as mCreate } from 'mutative';

export const jotaiStore = getDefaultStore();
