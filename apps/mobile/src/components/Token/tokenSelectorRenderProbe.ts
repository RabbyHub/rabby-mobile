import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import {
  WIDE_SCREEN_DEBUG_PANEL_DEFAULT_MIN_WIDTH,
  WIDE_SCREEN_DEBUG_PANEL_WIDTH,
  useWideScreenDebugPanelSetting,
} from '@/hooks/appSettings';
import { zCreate } from '@/core/utils/reexports';
import { tokenEntityResourceStore } from '@/store/tokens';
import type { ITokenItem, TokenEntityId } from '@/store/tokens';

export const WIDE_SCREEN_DEBUG_PANEL_MIN_WIDTH =
  WIDE_SCREEN_DEBUG_PANEL_DEFAULT_MIN_WIDTH;
export { WIDE_SCREEN_DEBUG_PANEL_WIDTH };

type TokenSelectorRenderProbeState = {
  renderProbeEnabled: boolean;
  activeTokenIds: TokenEntityId[];
  activeType?: string;
  activeChainServerId?: string;
  activeKeyword?: string;
  activeUpdatedAt?: number;
  mutationCount: number;
  lastMutation?: {
    at: number;
    tokenId: TokenEntityId;
    symbol?: string;
    chain?: string;
    amount?: number;
    usdValue?: number;
  };
};

export const useTokenSelectorRenderProbeStore =
  zCreate<TokenSelectorRenderProbeState>(() => ({
    renderProbeEnabled: false,
    activeTokenIds: [],
    mutationCount: 0,
  }));

export function useShouldShowWideScreenDebugPanel() {
  const { width } = useWindowDimensions();
  const { wideScreenDebugPanelEnabled, wideScreenDebugPanelMinWidth } =
    useWideScreenDebugPanelSetting();
  const requiredWidth =
    wideScreenDebugPanelMinWidth + WIDE_SCREEN_DEBUG_PANEL_WIDTH;

  return wideScreenDebugPanelEnabled ? width >= requiredWidth : false;
}

export function useShouldShowTokenSelectorRenderProbe() {
  const shouldShowPanel = useShouldShowWideScreenDebugPanel();
  const renderProbeEnabled = useTokenSelectorRenderProbeStore(
    state => state.renderProbeEnabled,
  );

  return shouldShowPanel && renderProbeEnabled;
}

export function useTokenSelectorRenderProbeEnabled() {
  return useTokenSelectorRenderProbeStore(state => state.renderProbeEnabled);
}

export function setTokenSelectorRenderProbeEnabled(enabled: boolean) {
  useTokenSelectorRenderProbeStore.setState(prev => ({
    ...prev,
    renderProbeEnabled: enabled,
  }));
}

export function toggleTokenSelectorRenderProbeEnabled(nextVal?: boolean) {
  useTokenSelectorRenderProbeStore.setState(prev => ({
    ...prev,
    renderProbeEnabled:
      typeof nextVal === 'boolean' ? nextVal : !prev.renderProbeEnabled,
  }));
}

export function useTokenSelectorRenderProbePanelState() {
  return useTokenSelectorRenderProbeStore(
    useShallow(state => ({
      renderProbeEnabled: state.renderProbeEnabled,
      activeTokenIds: state.activeTokenIds,
      activeType: state.activeType,
      activeChainServerId: state.activeChainServerId,
      activeKeyword: state.activeKeyword,
      activeUpdatedAt: state.activeUpdatedAt,
      mutationCount: state.mutationCount,
      lastMutation: state.lastMutation,
    })),
  );
}

export function useTokenSelectorRenderProbeActiveCount() {
  const activeTokenIds = useTokenSelectorRenderProbeStore(
    state => state.activeTokenIds,
  );

  return activeTokenIds.length;
}

export function setTokenSelectorRenderProbeActiveTokens(input: {
  tokenIds: TokenEntityId[];
  type?: string;
  chainServerId?: string;
  keyword?: string;
}) {
  useTokenSelectorRenderProbeStore.setState(prev => {
    if (
      prev.activeTokenIds === input.tokenIds &&
      prev.activeType === input.type &&
      prev.activeChainServerId === input.chainServerId &&
      prev.activeKeyword === input.keyword
    ) {
      return prev;
    }

    return {
      ...prev,
      activeTokenIds: input.tokenIds,
      activeType: input.type,
      activeChainServerId: input.chainServerId,
      activeKeyword: input.keyword,
      activeUpdatedAt: Date.now(),
    };
  });
}

export function clearTokenSelectorRenderProbeActiveTokens() {
  useTokenSelectorRenderProbeStore.setState(prev => {
    if (!prev.activeTokenIds.length) {
      return prev;
    }

    return {
      ...prev,
      activeTokenIds: [],
      activeType: undefined,
      activeChainServerId: undefined,
      activeKeyword: undefined,
      activeUpdatedAt: Date.now(),
    };
  });
}

function makeDebugTokenMutation(token: ITokenItem): ITokenItem {
  const amountBase =
    typeof token.amount === 'number' && Number.isFinite(token.amount)
      ? token.amount || 0
      : 0;
  const priceBase =
    typeof token.price === 'number' && Number.isFinite(token.price)
      ? token.price || 0
      : 0;
  const usdBase =
    typeof token.usd_value === 'number' && Number.isFinite(token.usd_value)
      ? token.usd_value || 0
      : amountBase * priceBase;

  const amountDeltaRatio = 0.92 + Math.random() * 0.16;
  const nextAmount = Math.max(
    amountBase * amountDeltaRatio + Math.random() * 0.0001,
    0,
  );
  const nextUsdValue = Math.max(
    usdBase * amountDeltaRatio + Math.random() * 0.01,
    0,
  );
  const price24hChangeBase = Number(token.price_24h_change || 0);

  return {
    ...token,
    amount: nextAmount,
    usd_value: nextUsdValue,
    price_24h_change:
      Math.round((price24hChangeBase + (Math.random() - 0.5) * 0.2) * 10000) /
      10000,
  };
}

function pickRandomTokenId(tokenIds: TokenEntityId[]) {
  if (!tokenIds.length) {
    return undefined;
  }

  return tokenIds[Math.floor(Math.random() * tokenIds.length)];
}

export function mutateRandomTokenSelectorProbeToken() {
  const { activeTokenIds } = useTokenSelectorRenderProbeStore.getState();
  const activeCandidates = activeTokenIds.filter(tokenId =>
    tokenEntityResourceStore.getValue(tokenId),
  );
  const candidates = activeCandidates.length
    ? activeCandidates
    : (Object.keys(tokenEntityResourceStore.getValueMap()) as TokenEntityId[]);
  const tokenId = pickRandomTokenId(candidates);
  const token = tokenEntityResourceStore.getValue(tokenId);

  if (!tokenId || !token) {
    return null;
  }

  const nextToken = makeDebugTokenMutation(token);
  tokenEntityResourceStore.upsertTokens([nextToken]);

  const mutation = {
    at: Date.now(),
    tokenId,
    symbol: nextToken.symbol,
    chain: nextToken.chain,
    amount: nextToken.amount,
    usdValue: nextToken.usd_value,
  };

  useTokenSelectorRenderProbeStore.setState(prev => ({
    ...prev,
    mutationCount: prev.mutationCount + 1,
    lastMutation: mutation,
  }));

  return mutation;
}

export function useTokenSelectorRenderProbeMetaText() {
  const {
    activeTokenIds,
    activeType,
    activeChainServerId,
    activeKeyword,
    mutationCount,
  } = useTokenSelectorRenderProbePanelState();

  return useMemo(
    () =>
      [
        `active rows: ${activeTokenIds.length}`,
        activeType ? `type: ${activeType}` : '',
        activeChainServerId ? `chain: ${activeChainServerId}` : '',
        activeKeyword ? `query: ${activeKeyword}` : '',
        `mutations: ${mutationCount}`,
      ]
        .filter(Boolean)
        .join(' / '),
    [
      activeChainServerId,
      activeKeyword,
      activeTokenIds.length,
      activeType,
      mutationCount,
    ],
  );
}
