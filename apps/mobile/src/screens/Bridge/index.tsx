import React from 'react';
import {
  QuoteVisibleProvider,
  RefreshIdProvider,
  SettingVisibleProvider,
} from './hooks';
import { BridgeContent } from './components/BridgeContent';

export const Bridge = () => {
  return (
    <SettingVisibleProvider>
      <RefreshIdProvider>
        <QuoteVisibleProvider>
          <BridgeContent />
        </QuoteVisibleProvider>
      </RefreshIdProvider>
    </SettingVisibleProvider>
  );
};
