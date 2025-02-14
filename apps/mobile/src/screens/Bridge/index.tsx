import React from 'react';
import {
  QuoteVisibleProvider,
  RefreshIdProvider,
  SettingVisibleProvider,
} from './hooks';
import { BridgeContent } from './components/BridgeContent';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';

export const Bridge = ({
  isForMultipleAdderss,
}: PropsForAccountSwitchScreen) => {
  useLastUsedAccountInScreen({ disableAutoEffect: isForMultipleAdderss });

  return (
    <SettingVisibleProvider>
      <RefreshIdProvider>
        <QuoteVisibleProvider>
          <BridgeContent isForMultipleAdderss={isForMultipleAdderss} />
        </QuoteVisibleProvider>
      </RefreshIdProvider>
    </SettingVisibleProvider>
  );
};

const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof Bridge>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  return (
    <ScreenSceneAccountProvider
      value={{ forScene: 'MakeTransactionAbout', ofScreen: 'MultiBridge' }}>
      <Bridge {...props} isForMultipleAdderss />
    </ScreenSceneAccountProvider>
  );
};

Bridge.ForMultipleAddress = ForMultipleAddress;
