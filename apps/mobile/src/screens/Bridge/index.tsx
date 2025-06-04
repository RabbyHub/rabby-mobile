import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import React from 'react';
import { TokenInfoPopup } from '../Swap/components/TokenInfoPopup';
import { BridgeContent } from './components/BridgeContent';
import {
  QuoteVisibleProvider,
  RefreshIdProvider,
  SettingVisibleProvider,
} from './hooks';

export const Bridge = ({
  isForMultipleAddress,
}: PropsForAccountSwitchScreen) => {
  return (
    <SettingVisibleProvider>
      <RefreshIdProvider>
        <QuoteVisibleProvider>
          <BridgeContent isForMultipleAddress={isForMultipleAddress} />
        </QuoteVisibleProvider>
      </RefreshIdProvider>
      <TokenInfoPopup />
    </SettingVisibleProvider>
  );
};

const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof Bridge>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'MakeTransactionAbout',
        ofScreen: 'MultiBridge',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-MultiBridge`,
      }}>
      <Bridge {...props} isForMultipleAddress />
    </ScreenSceneAccountProvider>
  );
};

Bridge.ForMultipleAddress = ForMultipleAddress;
