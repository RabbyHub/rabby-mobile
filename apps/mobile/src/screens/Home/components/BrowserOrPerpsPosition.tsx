import React, { Suspense } from 'react';
import { useHomeDisplayedTabs } from '@/hooks/browser/useBrowser';
import { BrowserSearchEntry } from '../../Browser/components/BrowserSearchEntry';

const PerpsMultiAssetPosition = React.lazy(() =>
  import('../../Perps/components/PerpsMultiAssetPosition').then(m => ({
    default: m.PerpsMultiAssetPosition,
  })),
);

export const BrowserOrPerpsPosition: React.FC = () => {
  const { homeDisplayedTabs } = useHomeDisplayedTabs();

  if (homeDisplayedTabs.length > 0) {
    return <BrowserSearchEntry />;
  }

  return (
    <Suspense fallback={null}>
      <PerpsMultiAssetPosition source="home" />
    </Suspense>
  );
};
