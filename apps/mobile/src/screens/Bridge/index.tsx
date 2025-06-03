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
import { TokenInfoPopup } from '../Swap/components/TokenInfoPopup';

export const Bridge = ({
  isForMultipleAddress,
}: PropsForAccountSwitchScreen) => {
  useLastUsedAccountInScreen({ disableAutoEffect: isForMultipleAddress });

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
