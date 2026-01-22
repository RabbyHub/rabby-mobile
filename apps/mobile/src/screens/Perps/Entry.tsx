import React, { useCallback, useMemo } from 'react';

import {
  DappSelectItem,
  INNER_DAPP_LIST,
} from '@/components2024/DappFrameAccountHeader';
import { InnerDappWebViewScreen } from '@/components2024/InnerDappWebViewScreen';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { PerpsOriginScreen } from './index';

const PERPS_LIST = INNER_DAPP_LIST.PERPS;
const DEFAULT_PERPS_ID = PERPS_LIST[0]?.id ?? 'hyperliquid';

const resolveActiveId = (list: DappSelectItem[], preferredId: string) => {
  if (!list.length) {
    return preferredId;
  }
  if (list.some(item => item.id === preferredId)) {
    return preferredId;
  }
  return list[0]?.id;
};

export function PerpsScreen() {
  const { perps, setPerps } = useInnerDappSelection();
  const activeId = useMemo(() => resolveActiveId(PERPS_LIST, perps), [perps]);
  const activeItem = useMemo(
    () => PERPS_LIST.find(item => item.id === activeId) || PERPS_LIST[0],
    [activeId],
  );

  const handleSelectDapp = useCallback(
    (item: DappSelectItem) => {
      setPerps(item.id);
    },
    [setPerps],
  );

  if (!activeId) {
    return null;
  }

  if (activeItem?.id !== DEFAULT_PERPS_ID) {
    return (
      <InnerDappWebViewScreen
        list={PERPS_LIST}
        activeId={activeId}
        onSelectDapp={handleSelectDapp}
      />
    );
  }

  return (
    <PerpsOriginScreen
      activeId={activeId}
      dappList={PERPS_LIST}
      onSelectDapp={handleSelectDapp}
    />
  );
}
