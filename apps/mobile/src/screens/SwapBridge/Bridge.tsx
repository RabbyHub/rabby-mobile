import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import React from 'react';
import { BridgeContent } from '../Bridge/components/BridgeContent';
import {
  QuoteVisibleProvider,
  RefreshIdProvider,
  SettingVisibleProvider,
} from '../Bridge/hooks';

type BridgeProps = PropsForAccountSwitchScreen<{
  disableHeaderRight?: boolean;
  disableAccountSwitcherModal?: boolean;
  diagnosticActive?: boolean;
  sceneActive?: boolean;
}>;

export const Bridge = ({
  isForMultipleAddress,
  disableHeaderRight,
  disableAccountSwitcherModal,
  diagnosticActive,
  sceneActive = true,
}: BridgeProps) => {
  return (
    <SettingVisibleProvider>
      <RefreshIdProvider>
        <QuoteVisibleProvider>
          <BridgeContent
            isForMultipleAddress={isForMultipleAddress}
            disableHeaderRight={disableHeaderRight}
            disableAccountSwitcherModal={disableAccountSwitcherModal}
            diagnosticActive={diagnosticActive}
            sceneActive={sceneActive}
          />
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
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'MakeTransactionAbout',
        ofScreen: 'MultiSwapBridge',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-MultiSwapBridge`,
      }}>
      <Bridge {...props} isForMultipleAddress />
    </ScreenSceneAccountProvider>
  );
};

Bridge.ForMultipleAddress = ForMultipleAddress;
