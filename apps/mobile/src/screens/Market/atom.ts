import { atom } from 'jotai';
import { TokenPriceListResponse } from '@rabby-wallet/rabby-api/dist/types';

export const marketRealtimePriceAtom = atom<TokenPriceListResponse>({});
