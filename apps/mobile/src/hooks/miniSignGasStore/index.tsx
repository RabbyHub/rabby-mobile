import { zustandByMMKV, MMKVStorageStrategy } from '@/core/storage/mmkv';
import { useCallback, useEffect, useState } from 'react';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

export const fixedCustomGasStore = zustandByMMKV(
  'miniSignCustomGas',
  {} as {
    [key: number]: number;
  },
  { storage: MMKVStorageStrategy.compatJson },
);

// Zustand implementation for gasLevel
type GasLevelState = 'normal' | 'slow' | 'fast' | 'custom';
const gasLevelStore = zCreate<GasLevelState>(() => 'normal');

function setGasLevelState(valOrFunc: UpdaterOrPartials<GasLevelState>) {
  gasLevelStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

// Zustand implementation for customPrice
type CustomPriceState = {
  [key: number]: number;
};

const customPriceStore = zCreate<CustomPriceState>(() => ({}));

function setCustomPriceState(valOrFunc: UpdaterOrPartials<CustomPriceState>) {
  customPriceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export const useMemoMiniSignGasStore = () => {
  const miniGasLevel = gasLevelStore();
  const miniCustomPrice = customPriceStore();

  const setMiniGasLevel = useCallback(
    (valOrFunc: UpdaterOrPartials<GasLevelState>) => {
      setGasLevelState(valOrFunc);
    },
    [],
  );

  const setMiniCustomPrice = useCallback(
    (valOrFunc: UpdaterOrPartials<CustomPriceState>) => {
      setCustomPriceState(valOrFunc);
    },
    [],
  );

  const reset = useCallback(() => {
    setGasLevelState('normal');
    setCustomPriceState({});
  }, []);

  return {
    miniGasLevel,
    setMiniGasLevel,
    miniCustomPrice,
    setMiniCustomPrice,
    updateMiniCustomPrice: setMiniCustomPrice,
    reset,
  };
};

export const useMiniSignFixedMode = (chainId?: number) => {
  const fixedCustomGas = fixedCustomGasStore();

  if (!chainId) {
    return false;
  }

  const num = fixedCustomGas?.[chainId];

  return typeof num === 'number' ? true : false;
};

export const useMiniSignGasStoreOrigin = () => {
  const miniGasLevel = gasLevelStore();
  const miniCustomPrice = customPriceStore();
  const fixedCustomGas = fixedCustomGasStore();

  const setMiniGasLevel = useCallback(
    (valOrFunc: UpdaterOrPartials<GasLevelState>) => {
      setGasLevelState(valOrFunc);
    },
    [],
  );

  const setMiniCustomPrice = useCallback(
    (valOrFunc: UpdaterOrPartials<CustomPriceState>) => {
      setCustomPriceState(valOrFunc);
    },
    [],
  );

  const setFixedCustomGas = useCallback(
    (valOrFunc: UpdaterOrPartials<typeof fixedCustomGas>) => {
      fixedCustomGasStore.setState(valOrFunc);
    },
    [],
  );

  return {
    miniGasLevel,
    setMiniGasLevel,
    miniCustomPrice,
    setMiniCustomPrice,
    fixedCustomGas,
    setFixedCustomGas,
  };
};

export const useMiniSignGasStore = (chainId: number) => {
  const miniGasLevel = gasLevelStore();
  const miniCustomPrice = customPriceStore();
  const fixedCustomGas = fixedCustomGasStore();

  const setMiniGasLevel = useCallback(
    (valOrFunc: UpdaterOrPartials<GasLevelState>) => {
      setGasLevelState(valOrFunc);
    },
    [],
  );

  const setMiniCustomPrice = useCallback(
    (valOrFunc: UpdaterOrPartials<CustomPriceState>) => {
      setCustomPriceState(valOrFunc);
    },
    [],
  );

  const setFixedCustomGas = useCallback(
    (valOrFunc: UpdaterOrPartials<typeof fixedCustomGas>) => {
      fixedCustomGasStore.setState(valOrFunc);
    },
    [],
  );

  const currentMiniSignGasLevel =
    fixedCustomGas?.[chainId] !== undefined ? 'custom' : miniGasLevel;

  const currentMiniCustomGas =
    fixedCustomGas?.[chainId] ?? miniCustomPrice?.[chainId];

  const updateMiniGas = useCallback(
    (params: {
      gasLevel: typeof miniGasLevel;
      chainId: number;
      customGasPrice?: number;
      fixed?: boolean;
    }) => {
      const isCustom = params.gasLevel === 'custom';
      setMiniGasLevel(params.gasLevel);

      setMiniCustomPrice(() =>
        isCustom
          ? {
              [params.chainId]: params.customGasPrice || 0,
            }
          : {},
      );

      const isFixedMode = isCustom && !!params.fixed;
      console.log('isFixedMode updateMiniGas', isFixedMode);

      setFixedCustomGas(pre => {
        let data = { ...pre };
        delete data[params.chainId];

        if (isFixedMode) {
          data[params.chainId] = params.customGasPrice || 0;
        }

        return data;
      });
    },
    [setFixedCustomGas, setMiniCustomPrice, setMiniGasLevel],
  );

  return {
    currentMiniSignGasLevel,
    currentMiniCustomGas,
    updateMiniGas,
  };
};

// 内置功能签名
// - 页面记忆 Instant/Fast/Normal, 重进页面前有效；
// - 链记忆 Custom，切链或重进页面前有效；
// - 每次重进页面重置为默认档位 Fast。
export const useClearMiniGasStateEffect = ({
  chainServerId,
}: {
  chainServerId?: string;
}) => {
  const { miniGasLevel, reset } = useMemoMiniSignGasStore();
  useEffect(() => {
    reset();
    return reset;
  }, [reset]);

  const [previousChainServerId, setPreviousChainServerId] =
    useState(chainServerId);

  if (previousChainServerId !== chainServerId) {
    setPreviousChainServerId(chainServerId);
    if (miniGasLevel === 'custom') {
      reset();
    }
  }
};
