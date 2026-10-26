import BigNumber from 'bignumber.js';

import type { ICacheProtocolItem, IProtocolItem } from '@/types/assets';
import { formatNetworth } from '@/utils/math';

export type ProtocolEntityId = string & {
  readonly __protocolEntityId: unique symbol;
};

export type ProtocolAssetsIndexResult = {
  protocolIds: ProtocolEntityId[];
  defaultVisibleProtocolCount: number;
  foldedProtocolUsdValue: string;
};

const EMPTY_PROTOCOL_ENTITY_IDS: ProtocolEntityId[] = [];

export const EMPTY_PROTOCOL_ASSETS_INDEX_RESULT: ProtocolAssetsIndexResult = {
  protocolIds: EMPTY_PROTOCOL_ENTITY_IDS,
  defaultVisibleProtocolCount: 0,
  foldedProtocolUsdValue: '',
};

export const buildProtocolEntityId = (
  protocol: Pick<IProtocolItem, 'owner_addr' | 'chain' | 'id'>,
): ProtocolEntityId =>
  [
    protocol.owner_addr.toLowerCase(),
    (protocol.chain || '').toLowerCase(),
    protocol.id.toLowerCase(),
  ].join(':') as ProtocolEntityId;

const sortProtocolsByNetWorth = (protocols: ICacheProtocolItem) =>
  protocols
    .map((protocol, sourceIndex) => ({ protocol, sourceIndex }))
    .sort(
      (left, right) =>
        (right.protocol.netWorth || 0) - (left.protocol.netWorth || 0) ||
        left.sourceIndex - right.sourceIndex,
    )
    .map(item => item.protocol);

const partitionProtocols = (protocols: ICacheProtocolItem) => {
  const sortedProtocols = sortProtocolsByNetWorth(protocols);
  const totalNetWorth = sortedProtocols.reduce(
    (total, protocol) => total + (Number(protocol.netWorth) || 0),
    0,
  );
  const threshold = Math.min(totalNetWorth / 1000, 1000);
  const thresholdIndex = sortedProtocols.findIndex(
    protocol => (Number(protocol.netWorth) || 0) < threshold,
  );
  const hasDefaultLimit =
    sortedProtocols.length > 3 &&
    thresholdIndex > -1 &&
    thresholdIndex <= sortedProtocols.length - 4;

  if (!hasDefaultLimit) {
    return {
      orderedProtocols: sortedProtocols,
      defaultVisibleProtocolCount: sortedProtocols.length,
      foldedProtocols: [] as IProtocolItem[],
    };
  }

  const defaultVisibleProtocols = sortedProtocols.filter(
    protocol => (Number(protocol.netWorth) || 0) >= threshold,
  );
  const foldedProtocols = sortedProtocols.filter(
    protocol => (Number(protocol.netWorth) || 0) < threshold,
  );

  return {
    orderedProtocols: defaultVisibleProtocols.concat(foldedProtocols),
    defaultVisibleProtocolCount: defaultVisibleProtocols.length,
    foldedProtocols,
  };
};

const getFoldedProtocolUsdValue = (protocols: IProtocolItem[]) =>
  protocols.length
    ? formatNetworth(
        protocols
          .reduce(
            (total, protocol) =>
              total.plus(
                protocol._portfolios.reduce(
                  (protocolTotal, portfolio) =>
                    protocolTotal.plus(
                      BigNumber.max(portfolio._sumTokenRealUsdValue || 0, 0),
                    ),
                  new BigNumber(0),
                ),
              ),
            new BigNumber(0),
          )
          .toNumber(),
        false,
        '$',
      )
    : '';

const buildStableProtocolIds = (
  protocols: IProtocolItem[],
  previousIds?: ProtocolEntityId[],
) => {
  if (!protocols.length) {
    return previousIds?.length
      ? EMPTY_PROTOCOL_ENTITY_IDS
      : previousIds || EMPTY_PROTOCOL_ENTITY_IDS;
  }

  const canReusePrevious = previousIds?.length === protocols.length;
  let nextIds: ProtocolEntityId[] | undefined = canReusePrevious
    ? undefined
    : [];

  protocols.forEach((protocol, index) => {
    const protocolId = buildProtocolEntityId(protocol);
    if (canReusePrevious && !nextIds) {
      if (previousIds![index] === protocolId) {
        return;
      }
      nextIds = previousIds!.slice(0, index);
    }
    nextIds!.push(protocolId);
  });

  return nextIds || previousIds!;
};

export const buildProtocolAssetsIndexResult = (
  result: ICacheProtocolItem,
  previousResult?: ProtocolAssetsIndexResult,
): ProtocolAssetsIndexResult => {
  const { orderedProtocols, defaultVisibleProtocolCount, foldedProtocols } =
    partitionProtocols(result);
  const protocolIds = buildStableProtocolIds(
    orderedProtocols,
    previousResult?.protocolIds,
  );
  const foldedProtocolUsdValue = getFoldedProtocolUsdValue(foldedProtocols);

  if (
    previousResult?.protocolIds === protocolIds &&
    previousResult.defaultVisibleProtocolCount ===
      defaultVisibleProtocolCount &&
    previousResult.foldedProtocolUsdValue === foldedProtocolUsdValue
  ) {
    return previousResult;
  }

  return {
    protocolIds,
    defaultVisibleProtocolCount,
    foldedProtocolUsdValue,
  };
};
