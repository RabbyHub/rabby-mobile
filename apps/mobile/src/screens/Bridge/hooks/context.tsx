import { createContextState } from '@/hooks/contextState';
import type { RabbyFeeTier } from '@/screens/Swap/hooks/fee';

const [SettingVisibleProvider, useSettingVisible, useSetSettingVisible] =
  createContextState<{ visible: boolean; feeTier?: RabbyFeeTier }>(
    { visible: false },
    true,
  );

const [QuoteVisibleProvider, useQuoteVisible, useSetQuoteVisible] =
  createContextState(false, true);

const [RefreshIdProvider, useRefreshId, useSetRefreshId] = createContextState(
  0,
  true,
);

export { SettingVisibleProvider, useSettingVisible, useSetSettingVisible };

export { RefreshIdProvider, useRefreshId, useSetRefreshId };

export { QuoteVisibleProvider, useQuoteVisible, useSetQuoteVisible };
