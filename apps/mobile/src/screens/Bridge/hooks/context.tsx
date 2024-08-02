import { createContextState } from '@/hooks/contextState';

const [SettingVisibleProvider, useSettingVisible, useSetSettingVisible] =
  createContextState(false, true);

const [QuoteVisibleProvider, useQuoteVisible, useSetQuoteVisible] =
  createContextState(false, true);

const [RefreshIdProvider, useRefreshId, useSetRefreshId] = createContextState(
  0,
  true,
);

export { SettingVisibleProvider, useSettingVisible, useSetSettingVisible };

export { RefreshIdProvider, useRefreshId, useSetRefreshId };

export { QuoteVisibleProvider, useQuoteVisible, useSetQuoteVisible };
