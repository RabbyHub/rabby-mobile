import { isNonPublicProductionEnv } from '@/constant';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useMemo } from 'react';

const MAKE_DEFAULT_MOCK_DATA = () => ({
  forceShowOffchainNotify: false,
});

// const homeCenterAreaMockData = atom({ ...MAKE_DEFAULT_MOCK_DATA() });

type HomeCenterAreaMockData = {
  devUIHomeCenterAreaModalVisible: boolean;
  mockData: ReturnType<typeof MAKE_DEFAULT_MOCK_DATA>;
};
const homeCenterAreaMockDataStore = zCreate<HomeCenterAreaMockData>(() => ({
  devUIHomeCenterAreaModalVisible: false,
  mockData: MAKE_DEFAULT_MOCK_DATA(),
}));

function setMockData(
  valOrFunc: UpdaterOrPartials<HomeCenterAreaMockData['mockData']>,
) {
  homeCenterAreaMockDataStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.mockData, valOrFunc);

    return { ...prev, mockData: newVal };
  });
}

export function useMockDataForHomeCenterArea() {
  const mockData = homeCenterAreaMockDataStore(s => s.mockData);

  const prodData = useMemo(() => MAKE_DEFAULT_MOCK_DATA(), []);

  return {
    mockData: isNonPublicProductionEnv ? mockData : prodData,
  };
}

export function useMakeMockDataForHomeCenterArea() {
  const { mockData } = useMockDataForHomeCenterArea();

  return {
    mockData,
    setMockData,
  };
}
