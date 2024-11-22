import React from 'react';
import {
  QuoteVisibleProvider,
  RefreshIdProvider,
  SettingVisibleProvider,
} from './hooks';
import { BridgeContent } from './components/BridgeContent';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';

export const Bridge = () => {
  useLastUsedAccountInScreen();

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
