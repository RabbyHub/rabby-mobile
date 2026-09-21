import React from 'react';
import { BrowserSearchEntry } from '../../Browser/components/BrowserSearchEntry';
import { PerpsMultiAssetPosition } from '../../Perps/components/PerpsMultiAssetPosition';

export const BrowserOrPerpsPosition: React.FC = () => {
  return (
    <>
      <PerpsMultiAssetPosition />
      <BrowserSearchEntry />
    </>
  );
};
