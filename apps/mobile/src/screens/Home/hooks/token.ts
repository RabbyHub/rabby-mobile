import { AbstractPortfolioToken } from '../types';
import { atom } from 'jotai';

// TODO: 重新整理，跟 token store 整合
export const testnetTokensAtom = atom({
  list: [] as AbstractPortfolioToken[],
});
