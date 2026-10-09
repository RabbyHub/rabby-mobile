import { addressUtils } from '@rabby-wallet/base-utils';
import type { IManageToken, ITokenItem } from '@/types/assets';
import {
  ensureRemovedTokensBinding,
  removedTokensStore,
} from './removedTokens';
import type {
  TokenAssetsIndexResult,
  TokenAssetsIndexSegments,
  TokenEntityId,
  useTokenAssetsIndexStore,
  tokenEntityResourceStore,
  buildSingleAssetsIndexFromTokenIds,
  buildMultiAssetsIndexFromTokenIds,
} from './tokens';

type Dependencies = {
  assetsStore: typeof useTokenAssetsIndexStore;
  tokenEntities: Pick<
    typeof tokenEntityResourceStore,
    'getValue' | 'getAddressVersion'
  >;
  buildSingleAssetsIndex: typeof buildSingleAssetsIndexFromTokenIds;
  buildMultiAssetsIndex: typeof buildMultiAssetsIndexFromTokenIds;
};
type TokenDisplayExclusion = {
  ensureBinding(): void;
  syncChangedTokens(tokenIds: TokenEntityId[], updateSource: () => void): void;
};

/** Adds removed-token display results to the existing Store without touching persistence. */
export function createTokenDisplayExclusion({
  assetsStore,
  tokenEntities,
  buildSingleAssetsIndex,
  buildMultiAssetsIndex,
}: Dependencies): TokenDisplayExclusion {
  type TokenDisplayProjectionCacheEntry = {
    source: TokenAssetsIndexResult;
    config: object;
    removedTokens: readonly IManageToken[];
    version: string;
    result: TokenAssetsIndexResult;
  };
  const tokenDisplayProjectionCache = new Map<
    string,
    TokenDisplayProjectionCacheEntry
  >();
  let tokenDisplayBindingsStarted = false;
  let syncingTokenDisplayResults = false;
  let sourceUpdateDepth = 0;
  const pendingAddresses = new Set<string>();
  let matchedRemovedTokens: readonly IManageToken[] | undefined;
  let removedTokensByChain = new Map<string, string[]>();

  function updateRemovedTokenLookup(removedTokens: readonly IManageToken[]) {
    if (matchedRemovedTokens === removedTokens) {
      return;
    }
    matchedRemovedTokens = removedTokens;
    removedTokensByChain = new Map();
    removedTokens.forEach(({ chainId, tokenId }) => {
      const chain = chainId.toLowerCase();
      const ids = removedTokensByChain.get(chain) || [];
      ids.push(tokenId);
      removedTokensByChain.set(chain, ids);
    });
  }
  function isRemoved(chain: string, id: string) {
    return (
      removedTokensByChain
        .get(chain.toLowerCase())
        ?.some(removedId => addressUtils.isSameAddress(removedId, id)) || false
    );
  }
  function isRemovedEntity(tokenId: TokenEntityId) {
    const [, chain, ...id] = tokenId.split(':');
    return !!chain && isRemoved(chain, id.join(':'));
  }

  function reuseList<T>(next: T[], previous?: T[]): T[] {
    return previous &&
      next.length === previous.length &&
      next.every((item, index) => item === previous[index])
      ? previous
      : next;
  }

  function filterStagedSingleResult(
    source: TokenAssetsIndexResult,
    isLpTokenEnabled: boolean | undefined,
    previous?: TokenAssetsIndexResult,
  ): TokenAssetsIndexResult {
    const segments = {} as TokenAssetsIndexSegments;
    (
      Object.keys(source.segments) as (keyof TokenAssetsIndexSegments)[]
    ).forEach(key => {
      const segment = source.segments[key];
      const previousSegment = previous?.segments[key];
      const rows = reuseList(
        segment.rows.filter(
          (_, index) => !isRemovedEntity(segment.tokenIds[index]!),
        ),
        previousSegment?.rows,
      );
      const tokenIds = reuseList(
        segment.tokenIds.filter(id => !isRemovedEntity(id)),
        previousSegment?.tokenIds,
      );
      segments[key] =
        previousSegment &&
        rows === previousSegment.rows &&
        tokenIds === previousSegment.tokenIds
          ? previousSegment
          : { rows, tokenIds };
    });
    const additional = isLpTokenEnabled
      ? segments.additionalLp
      : segments.additionalDefault;
    const lowValue = isLpTokenEnabled
      ? segments.lowValueLp
      : segments.lowValueDefault;
    const previewLogos = (
      key: 'lowValueDefault' | 'lowValueLp',
      cached: string[],
    ) =>
      source.segments[key].tokenIds
        .flatMap((id, index) => {
          if (isRemovedEntity(id)) {
            return [];
          }
          const logo = tokenEntities.getValue(id)?.logo_url || cached[index];
          return typeof logo === 'string' ? [logo] : [];
        })
        .slice(0, 3);
    const removedAdditionalValue =
      source.segments.additionalDefault.tokenIds.reduce((sum, id) => {
        const token = isRemovedEntity(id)
          ? tokenEntities.getValue(id)
          : undefined;
        return sum + (token?.is_core ? token.usd_value || 0 : 0);
      }, 0);
    const result: TokenAssetsIndexResult = {
      rows: reuseList(
        segments.primary.rows.concat(additional.rows, lowValue.rows),
        previous?.rows,
      ),
      tokenIds: reuseList(
        segments.primary.tokenIds.concat(
          additional.tokenIds,
          lowValue.tokenIds,
        ),
        previous?.tokenIds,
      ),
      segments,
      defaultVisibleTokenCount: segments.primary.rows.length,
      additionalTokenCount: additional.rows.length,
      lowValueTokenCount: lowValue.rows.length,
      additionalCoreUsdValue: Math.max(
        0,
        source.additionalCoreUsdValue - removedAdditionalValue,
      ),
      lowValueTokenPreviewLogoUrls: reuseList(
        previewLogos('lowValueDefault', source.lowValueTokenPreviewLogoUrls),
        previous?.lowValueTokenPreviewLogoUrls,
      ),
      lpLowValueTokenPreviewLogoUrls: reuseList(
        previewLogos('lowValueLp', source.lpLowValueTokenPreviewLogoUrls),
        previous?.lpLowValueTokenPreviewLogoUrls,
      ),
      hasAdditionalTokens:
        segments.additionalDefault.rows.length +
          segments.lowValueDefault.rows.length +
          segments.additionalLp.rows.length +
          segments.lowValueLp.rows.length >
        0,
      hasLpTokens:
        segments.additionalLp.rows.length + segments.lowValueLp.rows.length > 0,
    };
    if (
      previous &&
      (Object.keys(segments) as (keyof TokenAssetsIndexSegments)[]).every(
        key => segments[key] === previous.segments[key],
      )
    ) {
      result.segments = previous.segments;
    }
    return previous &&
      (Object.keys(result) as (keyof TokenAssetsIndexResult)[]).every(
        key => result[key] === previous[key],
      )
      ? previous
      : result;
  }

  function syncTokenDisplayResults(
    changedAddresses?: ReadonlySet<string>,
    changedKeys?: { single: ReadonlySet<string>; multi: ReadonlySet<string> },
  ) {
    if (
      !tokenDisplayBindingsStarted ||
      syncingTokenDisplayResults ||
      !removedTokensStore.getState().isReady
    ) {
      return;
    }
    syncingTokenDisplayResults = true;
    try {
      const source = assetsStore.getState();
      const removedTokens = removedTokensStore.getState().removedTokens;
      updateRemovedTokenLookup(removedTokens);
      let singleResults = source.singleDisplayAssetsResultByKey;
      let multiResults = source.multiDisplayAssetsResultByKey;
      const project = (scene: 'single' | 'multi', key: string) => {
        const config =
          scene === 'single'
            ? source.singleAssetsConfigByKey[key]
            : source.multiAssetsConfigByKey[key];
        const raw =
          scene === 'single'
            ? source.singleAssetsResultByKey[key]
            : source.multiAssetsResultByKey[key];
        if (!config || !raw) {
          if (scene === 'single' && singleResults[key]) {
            if (singleResults === source.singleDisplayAssetsResultByKey) {
              singleResults = { ...singleResults };
            }
            delete singleResults[key];
          } else if (scene === 'multi' && multiResults[key]) {
            if (multiResults === source.multiDisplayAssetsResultByKey) {
              multiResults = { ...multiResults };
            }
            delete multiResults[key];
          }
          tokenDisplayProjectionCache.delete(`${scene}:${key}`);
          return;
        }
        const addresses =
          'address' in config ? [config.address] : config.addresses;
        if (
          changedAddresses &&
          !addresses.some(address =>
            changedAddresses.has(address.toLowerCase()),
          )
        ) {
          return;
        }
        const version = addresses
          .map(address => tokenEntities.getAddressVersion(address))
          .join(':');
        const cacheKey = `${scene}:${key}`;
        const cached = tokenDisplayProjectionCache.get(cacheKey);
        if (
          cached?.source === raw &&
          cached.config === config &&
          cached.version === version &&
          cached.removedTokens === removedTokens
        ) {
          return;
        }
        let result = raw;
        if (
          removedTokens.length &&
          (!config.chainServerId ||
            removedTokensByChain.has(config.chainServerId.toLowerCase()))
        ) {
          const tokenIds =
            scene === 'single'
              ? Array.from(
                  new Set(
                    config.tokenIds.concat(
                      Object.values(raw.segments).flatMap(
                        segment => segment.tokenIds,
                      ),
                    ),
                  ),
                )
              : config.tokenIds;
          if (tokenIds.some(isRemovedEntity)) {
            const includeToken = (token: ITokenItem) =>
              !isRemoved(token.chain, token.id);
            if ('address' in config) {
              result = tokenIds.some(id => !tokenEntities.getValue(id))
                ? filterStagedSingleResult(
                    raw,
                    config.isLpTokenEnabled,
                    cached?.result,
                  )
                : buildSingleAssetsIndex(
                    tokenIds,
                    config.chainServerId,
                    config.isLpTokenEnabled,
                    cached?.result,
                    includeToken,
                  );
            } else {
              // Isolate filtered groups from the full groups used by persistence.
              result = buildMultiAssetsIndex(
                tokenIds,
                config.chainServerId,
                config.isLpTokenEnabled,
                config.tokenDisplayMode,
                `${key}::portfolio`,
                cached?.result,
                includeToken,
              );
            }
          }
        }
        tokenDisplayProjectionCache.set(cacheKey, {
          source: raw,
          config,
          removedTokens,
          version,
          result,
        });
        if (scene === 'single' && singleResults[key] !== result) {
          if (singleResults === source.singleDisplayAssetsResultByKey) {
            singleResults = { ...singleResults };
          }
          singleResults[key] = result;
        } else if (scene === 'multi' && multiResults[key] !== result) {
          if (multiResults === source.multiDisplayAssetsResultByKey) {
            multiResults = { ...multiResults };
          }
          multiResults[key] = result;
        }
      };
      const singleKeys =
        changedKeys?.single ||
        new Set([
          ...Object.keys(source.singleAssetsConfigByKey),
          ...Object.keys(source.singleDisplayAssetsResultByKey),
        ]);
      const multiKeys =
        changedKeys?.multi ||
        new Set([
          ...Object.keys(source.multiAssetsConfigByKey),
          ...Object.keys(source.multiDisplayAssetsResultByKey),
        ]);
      singleKeys.forEach(key => project('single', key));
      multiKeys.forEach(key => project('multi', key));
      if (
        singleResults !== source.singleDisplayAssetsResultByKey ||
        multiResults !== source.multiDisplayAssetsResultByKey
      ) {
        assetsStore.setState(draft => {
          draft.singleDisplayAssetsResultByKey = singleResults;
          draft.multiDisplayAssetsResultByKey = multiResults;
        });
      }
    } finally {
      syncingTokenDisplayResults = false;
    }
  }

  function collectChangedKeys(
    next: Record<string, unknown>,
    previous: Record<string, unknown>,
    keys: Set<string>,
  ) {
    if (next === previous) {
      return;
    }
    Object.keys(next).forEach(key => {
      if (next[key] !== previous[key]) {
        keys.add(key);
      }
    });
    Object.keys(previous).forEach(key => {
      if (!(key in next)) {
        keys.add(key);
      }
    });
  }

  // Initialize through the existing single/multi projection preparation entries.
  function ensureTokenDisplayExclusionBinding() {
    const isFirstDemand = !tokenDisplayBindingsStarted;
    if (isFirstDemand) {
      tokenDisplayBindingsStarted = true;
      assetsStore.subscribe((state, previous) => {
        // The token-update wrapper flushes once after all raw results are ready.
        if (
          sourceUpdateDepth ||
          (state.singleAssetsResultByKey === previous.singleAssetsResultByKey &&
            state.multiAssetsResultByKey === previous.multiAssetsResultByKey &&
            state.singleAssetsConfigByKey ===
              previous.singleAssetsConfigByKey &&
            state.multiAssetsConfigByKey === previous.multiAssetsConfigByKey)
        ) {
          return;
        }
        const single = new Set<string>();
        const multi = new Set<string>();
        collectChangedKeys(
          state.singleAssetsResultByKey,
          previous.singleAssetsResultByKey,
          single,
        );
        collectChangedKeys(
          state.singleAssetsConfigByKey,
          previous.singleAssetsConfigByKey,
          single,
        );
        collectChangedKeys(
          state.multiAssetsResultByKey,
          previous.multiAssetsResultByKey,
          multi,
        );
        collectChangedKeys(
          state.multiAssetsConfigByKey,
          previous.multiAssetsConfigByKey,
          multi,
        );
        if (single.size || multi.size) {
          syncTokenDisplayResults(undefined, { single, multi });
        }
      });
      removedTokensStore.subscribe((state, previous) => {
        if (
          state.removedTokens !== previous.removedTokens ||
          state.isReady !== previous.isReady
        ) {
          syncTokenDisplayResults();
        }
      });
    }
    ensureRemovedTokensBinding().catch(console.error);
    if (isFirstDemand) {
      syncTokenDisplayResults();
    }
  }

  return {
    ensureBinding: ensureTokenDisplayExclusionBinding,
    syncChangedTokens(tokenIds, updateSource) {
      if (!tokenDisplayBindingsStarted) {
        updateSource();
        return;
      }
      tokenIds.forEach(id => pendingAddresses.add(id.split(':', 1)[0]!));
      sourceUpdateDepth += 1;
      try {
        updateSource();
      } finally {
        sourceUpdateDepth -= 1;
        if (!sourceUpdateDepth) {
          const addresses = new Set(pendingAddresses);
          pendingAddresses.clear();
          syncTokenDisplayResults(addresses);
        }
      }
    },
  };
}
