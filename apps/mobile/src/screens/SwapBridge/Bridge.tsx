import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import React from 'react';
import { TokenInfoPopup } from '../Swap/components/TokenInfoPopup';
import { BridgeContent } from '../Bridge/components/BridgeContent';
import {
  QuoteVisibleProvider,
  RefreshIdProvider,
  SettingVisibleProvider,
} from '../Bridge/hooks';

type BridgeProps = PropsForAccountSwitchScreen<{
  disableHeaderRight?: boolean;
  disableAccountSwitcherModal?: boolean;
}>;

export const Bridge = ({
  isForMultipleAddress,
  disableHeaderRight,
  disableAccountSwitcherModal,
}: BridgeProps) => {
  return (
    <SettingVisibleProvider>
      <RefreshIdProvider>
        <QuoteVisibleProvider>
          <BridgeContent
            isForMultipleAddress={isForMultipleAddress}
            disableHeaderRight={disableHeaderRight}
            disableAccountSwitcherModal={disableAccountSwitcherModal}
          />
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
        ofScreen: 'MultiSwapBridge',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-MultiSwapBridge`,
      }}>
      <Bridge {...props} isForMultipleAddress />
    </ScreenSceneAccountProvider>
  );
};

Bridge.ForMultipleAddress = ForMultipleAddress;
