import BigNumber from 'bignumber.js';

import type { ICacheProtocolItem, IProtocolItem } from '@/types/assets';
import { formatNetworth } from '@/utils/math';

export type ProtocolEntityId = string & {
  readonly __protocolEntityId: unique symbol;
};

export type ProtocolAssetsIndexResult = {
  foldIds: ProtocolEntityId[];
  unFoldIds: ProtocolEntityId[];
  foldDeFiValue: string;
};

const EMPTY_PROTOCOL_ENTITY_IDS: ProtocolEntityId[] = [];

export const EMPTY_PROTOCOL_ASSETS_INDEX_RESULT: ProtocolAssetsIndexResult = {
  foldIds: EMPTY_PROTOCOL_ENTITY_IDS,
  unFoldIds: EMPTY_PROTOCOL_ENTITY_IDS,
  foldDeFiValue: '',
};

export const buildProtocolEntityId = (
  protocol: Pick<IProtocolItem, 'owner_addr' | 'chain' | 'id'>,
): ProtocolEntityId =>
  [
    protocol.owner_addr.toLowerCase(),
    (protocol.chain || '').toLowerCase(),
    protocol.id.toLowerCase(),
  ].join(':') as ProtocolEntityId;

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

const getFoldDefiValue = (protocols: IProtocolItem[]) => {
  const total = protocols.reduce((protocolTotal, protocol) => {
    const protocolValue = protocol._portfolios.reduce(
      (portfolioTotal, portfolio) =>
        portfolioTotal.plus(
          portfolio._sumTokenRealUsdValue < 0
            ? 0
            : portfolio._sumTokenRealUsdValue || 0,
        ),
      new BigNumber(0),
    );
    return protocolTotal.plus(protocolValue);
  }, new BigNumber(0));

  return formatNetworth(total.toNumber(), false, '$');
};

export const buildProtocolAssetsIndexResult = (
  result: ICacheProtocolItem,
  previousResult?: ProtocolAssetsIndexResult,
): ProtocolAssetsIndexResult => {
  const unFoldIds = buildStableProtocolIds(
    result.unFold,
    previousResult?.unFoldIds,
  );
  const foldIds = buildStableProtocolIds(result.fold, previousResult?.foldIds);
  const foldDeFiValue = getFoldDefiValue(result.fold);

  if (
    previousResult &&
    previousResult.unFoldIds === unFoldIds &&
    previousResult.foldIds === foldIds &&
    previousResult.foldDeFiValue === foldDeFiValue
  ) {
    return previousResult;
  }

  return {
    foldIds,
    unFoldIds,
    foldDeFiValue,
  };
};
