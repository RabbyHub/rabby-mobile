import { openapi } from '@/core/request';
import { tokenKey } from '../engine/keys';
import { toMemeMarketItem } from './market';
import type { MemeMarketItem } from './types';

// Temporary source until the MemeCoin backend ships (spec U2): top 200 memes by fdv.
const PAGE_SIZE = 100;
const MAX_PAGES = 2;

export const fetchMemeMarket = async (): Promise<MemeMarketItem[]> => {
  const result: MemeMarketItem[] = [];
  const seen = new Set<string>();
  let cursor = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await openapi.getTokenMarketTokenList({
      category_id: 'meme',
      order_by: 'fdv',
      order: 'desc',
      limit: PAGE_SIZE,
      cursor,
    });
    for (const raw of res.data_list) {
      const meme = toMemeMarketItem(raw);
      const key = tokenKey(meme);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(meme);
      }
    }
    if (!res.pagination?.has_next || !res.pagination.next_cursor) {
      break;
    }
    cursor = res.pagination.next_cursor;
  }
  return result;
};
