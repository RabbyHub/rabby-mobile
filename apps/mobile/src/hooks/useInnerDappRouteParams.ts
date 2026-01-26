import { useCallback } from 'react';

import { zCreate } from '@/core/utils/reexports';
import { Account } from '@/core/services/preference';

export type InnerDappScene = 'Perps' | 'Lending';

export type InnerDappRouteParams = {
  dappId?: string;
  account?: Account | null;
};

type InnerDappRouteParamsState = {
  perps: InnerDappRouteParams | null;
  lending: InnerDappRouteParams | null;
};

const innerDappRouteParamsStore = zCreate<InnerDappRouteParamsState>(() => ({
  perps: null,
  lending: null,
}));

const getSceneKey = (scene: InnerDappScene) =>
  scene === 'Perps' ? 'perps' : 'lending';

export function setInnerDappRouteParams(
  scene: InnerDappScene,
  params: InnerDappRouteParams | null,
) {
  const key = getSceneKey(scene);
  innerDappRouteParamsStore.setState(prev => ({
    ...prev,
    [key]: params,
  }));
}

export function useInnerDappRouteParams(scene: InnerDappScene) {
  const key = getSceneKey(scene);
  const params = innerDappRouteParamsStore(s => s[key]);

  const clear = useCallback(() => {
    setInnerDappRouteParams(scene, null);
  }, [scene]);

  return { params, clear };
}
