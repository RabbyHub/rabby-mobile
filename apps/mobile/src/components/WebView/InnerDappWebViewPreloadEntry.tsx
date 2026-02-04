import React from 'react';

import { useInnerDappPreloadStrategy } from '@/config/innerDappPreloadStrategy';

import InnerDappWebViewPreloadLayer from './InnerDappWebViewPreloadLayer';

export const InnerDappWebViewPreloadEntry = () => {
  const strategy = useInnerDappPreloadStrategy();
  if (strategy !== 'legacy') {
    return null;
  }

  return <InnerDappWebViewPreloadLayer offscreenPreload />;
};
