import React from 'react';
import { useHomeDisplayedTabs } from '@/hooks/browser/useBrowser';
import { BrowserSearchEntry } from '../../Browser/components/BrowserSearchEntry';
import { PerpsMultiAssetPosition } from '../../Perps/components/PerpsMultiAssetPosition';

export const BrowserOrPerpsPosition: React.FC = () => {
  const { homeDisplayedTabs } = useHomeDisplayedTabs();

  if (homeDisplayedTabs.length > 0) {
    return <BrowserSearchEntry />;
  }

  return <PerpsMultiAssetPosition />;
};
