import { isNonPublicProductionEnv } from '@/constant';

import { CustomMarket, marketsData } from './config/market';
import {
  apisLending,
  debugProbeLendingMarket,
  setLendingMarketKey,
} from './hooks';

export type LendingDebugAction = 'open' | 'refresh' | 'probe';

const MARKET_ALIASES: Record<string, CustomMarket> = {
  core: CustomMarket.proto_mainnet_v3,
  ethereum: CustomMarket.proto_mainnet_v3,
  mainnet: CustomMarket.proto_mainnet_v3,
  megaeth: CustomMarket.proto_megaeth_v3,
  plasma: CustomMarket.proto_plasma_v3,
};

function resolveMarketKey(value?: string) {
  const normalized = value?.trim().toLowerCase() || 'core';
  const alias = MARKET_ALIASES[normalized];
  if (alias) {
    return alias;
  }

  const marketKey = value as CustomMarket | undefined;
  return marketKey && marketsData[marketKey] ? marketKey : null;
}

export async function runNonProductionLendingDebugCommand(
  command: {
    action: LendingDebugAction;
    market?: string;
  },
  handlers: {
    openLending: () => void;
  },
) {
  if (!isNonPublicProductionEnv) {
    return;
  }

  const marketKey = resolveMarketKey(command.market);
  if (!marketKey) {
    console.warn('[Lending] unknown debug market', command.market);
    return;
  }

  console.info('[Lending] debug command', {
    action: command.action,
    marketKey,
  });

  setLendingMarketKey(marketKey);
  if (command.action === 'open') {
    handlers.openLending();
    return;
  }

  if (command.action === 'refresh') {
    await apisLending.fetchLendingData({
      ignoreLoading: true,
      marketKey,
    });
    return;
  }

  await debugProbeLendingMarket(marketKey);
}
