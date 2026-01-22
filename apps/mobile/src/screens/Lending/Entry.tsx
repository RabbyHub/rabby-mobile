import React, { useCallback, useMemo } from 'react';

import {
  DappSelectItem,
  INNER_DAPP_LIST,
} from '@/components2024/DappFrameAccountHeader';
import { InnerDappWebViewScreen } from '@/components2024/InnerDappWebViewScreen';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';

import { LendingNativeScreen } from './';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';

const LENDING_LIST = INNER_DAPP_LIST.LENDING;
const DEFAULT_LENDING_ID = LENDING_LIST[0]?.id ?? 'aave';

const resolveActiveId = (list: DappSelectItem[], preferredId: string) => {
  if (!list.length) {
    return preferredId;
  }
  if (list.some(item => item.id === preferredId)) {
    return preferredId;
  }
  return list[0]?.id;
};

export function LendingEntryScreen() {
  const { lending, setLending } = useInnerDappSelection();
  const activeId = useMemo(
    () => resolveActiveId(LENDING_LIST, lending),
    [lending],
  );
  const activeItem = useMemo(
    () => LENDING_LIST.find(item => item.id === activeId) || LENDING_LIST[0],
    [activeId],
  );

  const handleSelectDapp = useCallback(
    (item: DappSelectItem) => {
      setLending(item.id);
    },
    [setLending],
  );

  if (!activeId) {
    return null;
  }

  if (activeItem?.id !== DEFAULT_LENDING_ID) {
    return (
      <InnerDappWebViewScreen
        list={LENDING_LIST}
        activeId={activeId}
        onSelectDapp={handleSelectDapp}
      />
    );
  }

  return (
    <LendingNativeScreen
      activeId={activeId}
      dappList={LENDING_LIST}
      onSelectDapp={handleSelectDapp}
    />
  );
}

const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof LendingEntryScreen>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'Lending',
        ofScreen: 'Lending',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-Lending`,
      }}>
      <LendingEntryScreen {...props} />
    </ScreenSceneAccountProvider>
  );
};

export default ForMultipleAddress;
