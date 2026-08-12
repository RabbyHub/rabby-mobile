import type { ICacheProtocolItem, IProtocolItem } from '@/types/assets';

export type ProtocolEntityId = string & {
  readonly __protocolEntityId: unique symbol;
};

export type ProtocolAssetsIndexResult = {
  protocolIds: ProtocolEntityId[];
};

const EMPTY_PROTOCOL_ENTITY_IDS: ProtocolEntityId[] = [];

export const EMPTY_PROTOCOL_ASSETS_INDEX_RESULT: ProtocolAssetsIndexResult = {
  protocolIds: EMPTY_PROTOCOL_ENTITY_IDS,
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
  const sortedResult = sortProtocolsByNetWorth(result);
  const protocolIds = buildStableProtocolIds(
    sortedResult,
    previousResult?.protocolIds,
  );

  if (previousResult?.protocolIds === protocolIds) {
    return previousResult;
  }

  return { protocolIds };
};
