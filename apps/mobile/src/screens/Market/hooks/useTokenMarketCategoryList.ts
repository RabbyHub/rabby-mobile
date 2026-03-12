import { openapi } from '@/core/request';
import { TokenMarketCategoryItem } from '@rabby-wallet/rabby-api/dist/types';
import { useEffect, useState } from 'react';

export const useTokenMarketCategoryList = () => {
  const [categories, setCategories] = useState<TokenMarketCategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await openapi.getTokenMarketCategoryList();
        setCategories(
          [...(res.categories || [])].sort(
            (a, b) => (a.display_order || 0) - (b.display_order || 0),
          ),
        );
      } catch (error) {
        console.error('getTokenMarketCategoryList error', error);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return {
    categories,
    loading,
  };
};
