import dayjs from 'dayjs';

import {
  type ApprovalItem,
  type ApprovalSpenderItemToBeRevoked,
  type ContractApprovalItem,
  type SpenderInNFTApproval,
  type AssetApprovalSpender,
  RiskNumMap,
  compareContractApprovalItemByRiskLevel,
  TokenApprovalIndexedBySpender,
} from '@rabby-wallet/biz-utils/dist/isomorphic/approval';

import {
  NFTApproval,
  NFTApprovalContract,
  Spender,
  TokenApproval,
} from '@rabby-wallet/rabby-api/dist/types';
import { Chain } from '@debank/common';
import { getAddressScanLink } from '@/utils/address';
import { openExternalUrl } from '@/core/utils/linking';
import { urlUtils } from '@rabby-wallet/base-utils';
import { approvalUtils } from '@rabby-wallet/biz-utils';
import { ObjectMirror } from '@/utils/type';

type SpendersHost = ApprovalItem['list'][number];

export function formatTimeFromNow(time?: Date | number) {
  if (!time) return '';

  const obj = dayjs(time);
  if (!obj.isValid()) return '';

  dayjs.updateLocale('en', {
    relativeTime: {
      future: 'in %s',
      past: '%s ago',
      s: 'a few seconds',
      m: '1 minute',
      mm: '%d minutes',
      h: '1 hour',
      hh: '%d hours',
      d: '1 day',
      dd: '%d days',
      M: '1 month',
      MM: '%d months',
      y: '1 year',
      yy: '%d years',
    },
  });

  return dayjs(time).fromNow();
}

export function isRiskyContract(contract: ContractApprovalItem) {
  return ['danger', 'warning'].includes(contract.risk_level);
}

export function checkCompareContractItem(
  a: ContractApprovalItem,
  b: ContractApprovalItem,
) {
  const comparison = compareContractApprovalItemByRiskLevel(a, b);

  return {
    comparison,
    shouldEarlyReturn: !!comparison,
  };
}

export function encodeRevokeItemIndex(approval: ApprovalItem) {
  return `${approval.chain}:${approval.id}`;
}

export function parseContractApprovalListItem(
  spender: ContractApprovalItem['list'][number],
) {
  // NFTApproval | NFTApprovalContract | TokenApproval
  const id =
    (spender as NFTApproval | TokenApproval).id ||
    (spender as NFTApprovalContract).spender.id;

  return {
    id,
    chain: spender.chain,
  };
}

export function encodeApprovalKey(approvalItem: ApprovalItem) {
  switch (approvalItem.type) {
    // default: {
    //   return `${approvalItem.chain}:${approvalItem.id}`;
    // }
    case 'token':
    case 'nft':
    case 'contract': {
      return `${approvalItem.type}-${approvalItem.chain}-${approvalItem.id}`;
    }
  }
}

export function makeApprovalIndexURLBase(approval: ApprovalItem) {
  const approvalKey = encodeApprovalKey(approval);
  return `approval://${approvalKey}`;
}

export type ApprovalProcessType = 'contract' | 'assets';
export type RevokeItemDict = Record<string, ApprovalSpenderItemToBeRevoked>;

/**
 * @description the key function to serialize the ContractApprovalItem or AssetApprovalItem,
 * used as selection key of spender in the approval list
 */
export function encodeApprovalSpenderKey<T extends ApprovalItem>(
  approval: T,
  spenderHost: T['list'][number],
  assetApprovalSpenderOrIsContractItem?: AssetApprovalSpender | true,
) {
  const approvalIndexBase = makeApprovalIndexURLBase(approval);

  if (approval.type === 'contract') {
    const assetApprovalSpender =
      assetApprovalSpenderOrIsContractItem === true
        ? '$indexderSpender' in spenderHost
          ? spenderHost.$indexderSpender
          : null
        : assetApprovalSpenderOrIsContractItem ?? null;

    const permit2Id = assetApprovalSpender?.permit2_id;
    if ('inner_id' in spenderHost) {
      const abi = spenderHost?.is_erc721
        ? 'ERC721'
        : spenderHost?.is_erc1155
        ? 'ERC1155'
        : '';
      return `${approvalIndexBase}/contract-token/?${urlUtils.obj2query({
        chainServerId: spenderHost.chain,
        contractId: spenderHost.contract_id,
        permit2Id: permit2Id ?? '',
        spender: spenderHost.spender.id,
        abi,
        nftTokenId: spenderHost.inner_id,
        isApprovedForAll: 'false',
      })}`;
    } else if ('contract_name' in spenderHost) {
      const abi = spenderHost?.is_erc721
        ? 'ERC721'
        : spenderHost?.is_erc1155
        ? 'ERC1155'
        : '';
      return `${approvalIndexBase}/contract/?${urlUtils.obj2query({
        chainServerId: spenderHost?.chain,
        contractId: spenderHost?.contract_id,
        permit2Id: permit2Id ?? '',
        spender: spenderHost?.spender?.id,
        abi,
        isApprovedForAll: 'true',
      })}`;
    } else {
      return `${approvalIndexBase}/contract/?${urlUtils.obj2query({
        chainServerId: approval.chain,
        permit2Id: permit2Id ?? '',
        tokenId: spenderHost?.id,
        id: spenderHost?.id,
        spender: approval.id,
      })}`;
    }
  } else if (approval.type === 'token') {
    return `${approvalIndexBase}/token/?${urlUtils.obj2query({
      spender: (spenderHost as Spender).id,
      chainServerId: approval.chain,
      id: approval.id,
    })}`;
  } else if (approval.type === 'nft') {
    const isNftContracts = !!approval.nftContract;
    const nftInfo = isNftContracts ? approval.nftContract : approval.nftToken;

    const abi = nftInfo?.is_erc721
      ? 'ERC721'
      : nftInfo?.is_erc1155
      ? 'ERC1155'
      : '';

    return `${approvalIndexBase}/nft/?${urlUtils.obj2query({
      chainServerId: approval?.chain,
      contractId: nftInfo?.contract_id || '',
      spender: (spenderHost as Spender).id,
      nftTokenId: (nftInfo as NFTApproval)?.inner_id || '',
      abi,
      isApprovedForAll: nftInfo && 'inner_id' in nftInfo ? 'false' : 'true',
    })}`;
  }

  return approvalIndexBase;
}

type TParseMaps = {
  curAllSelectedMap: RevokeItemDict;
  nextKeepMap?: RevokeItemDict;
};
export function parseApprovalSpenderSelection<T extends TParseMaps>(
  approval: ApprovalItem | null,
  type: ApprovalProcessType,
  maps: T,
): {
  curSelectedSpenderKeys: Set<string>;
  curSelectedMap: RevokeItemDict;
  isSelectedAll: boolean;
  isSelectedPartial: boolean;
} & (T['nextKeepMap'] extends void
  ? {}
  : {
      postSelectedMap: RevokeItemDict;
    }) {
  const isAssetItem = type === 'assets';

  const { curAllSelectedMap } = maps;

  const preset = {
    curSelectedSpenderKeys: new Set<string>(),
    curSelectedMap: <Record<string, ApprovalSpenderItemToBeRevoked>>{},
    isSelectedAll: false,
    isSelectedPartial: false,
    postSelectedMap: <Record<string, ApprovalSpenderItemToBeRevoked>>{
      ...curAllSelectedMap,
    },
  };
  if (!approval) return preset;

  approval.list.reduce(
    (
      acc,
      member:
        | ContractApprovalItem['list'][number]
        | ApprovalItem['list'][number],
    ) => {
      const indexKey = isAssetItem
        ? encodeApprovalSpenderKey(
            (member as AssetApprovalSpender).$assetContract!,
            (member as AssetApprovalSpender).$assetToken!,
            member as AssetApprovalSpender,
          )
        : encodeApprovalSpenderKey(approval, member, true);

      const nextS = maps.nextKeepMap?.[indexKey]
        ? { key: indexKey, item: maps.nextKeepMap?.[indexKey] }
        : null;
      if (curAllSelectedMap[indexKey]) {
        acc.curSelectedSpenderKeys.add(indexKey);
        acc.curSelectedMap[indexKey] = curAllSelectedMap[indexKey];

        if (!nextS) {
          delete acc.postSelectedMap[indexKey];
        }
      }

      if (nextS) {
        acc.postSelectedMap[indexKey] = nextS.item;
      }

      return acc;
    },
    preset,
  );

  preset.isSelectedAll =
    approval.list.length === preset.curSelectedSpenderKeys.size;
  preset.isSelectedPartial =
    !preset.isSelectedAll && preset.curSelectedSpenderKeys.size > 0;

  return preset;
}

export function querySelectedContractSpender(
  assetRevokeMap: Record<string, ApprovalSpenderItemToBeRevoked>,
  approval: ContractApprovalItem,
  contract?: ContractApprovalItem['list'][number] | null,
) {
  if (!contract) return null;
  const key = encodeApprovalSpenderKey(approval, contract, true);
  return key && assetRevokeMap[key]
    ? { spenderKey: key, spender: assetRevokeMap[key] }
    : null;
}

export function querySelectedAssetSpender(
  assetRevokeMap: Record<string, ApprovalSpenderItemToBeRevoked>,
  spender?: approvalUtils.AssetApprovalSpender | null,
) {
  if (!spender || !spender.$assetContract || !spender.$assetToken) return null;
  const key = encodeApprovalSpenderKey(
    spender.$assetContract,
    spender.$assetToken,
    spender,
  );
  return key && assetRevokeMap[key]
    ? { spenderKey: key, spender: assetRevokeMap[key] }
    : null;
}

export function getAbiType<
  T extends SpendersHost = ApprovalItem['list'][number],
>(spenderHost: T) {
  if ('is_erc721' in spenderHost && spenderHost.is_erc721) return 'ERC721';
  if ('is_erc1155' in spenderHost && spenderHost.is_erc1155) return 'ERC1155';

  return '';
}

export const toRevokeItem = <T extends ApprovalItem>(
  item: T,
  spenderHost: T['list'][number],
  assetApprovalSpenderOrIsContractItem?: AssetApprovalSpender | true,
): ApprovalSpenderItemToBeRevoked | undefined => {
  if (item.type === 'contract') {
    const assetApprovalSpender =
      assetApprovalSpenderOrIsContractItem === true
        ? '$indexderSpender' in spenderHost
          ? spenderHost.$indexderSpender
          : null
        : assetApprovalSpenderOrIsContractItem ?? null;

    const permit2Id = assetApprovalSpender?.permit2_id;

    if ('inner_id' in spenderHost) {
      return {
        approvalType: 'contract',
        chainServerId: spenderHost?.chain,
        contractId: spenderHost?.contract_id,
        permit2Id,
        spender: spenderHost?.spender?.id,
        abi: getAbiType(spenderHost),
        nftTokenId: spenderHost?.inner_id,
        isApprovedForAll: false,
      } as const;
    } else if ('contract_name' in spenderHost) {
      return {
        approvalType: 'contract',
        chainServerId: spenderHost?.chain,
        contractId: spenderHost?.contract_id,
        permit2Id,
        spender: spenderHost?.spender?.id,
        nftTokenId: null,
        nftContractName: spenderHost?.contract_name,
        abi: getAbiType(spenderHost),
        isApprovedForAll: true,
      } as const;
    } else {
      return {
        approvalType: 'contract',
        chainServerId: item.chain,
        permit2Id,
        tokenId: spenderHost?.id,
        id: spenderHost?.id,
        spender: item.id,
      };
    }
  }

  if (item.type === 'token') {
    return {
      approvalType: 'token',
      chainServerId: item.chain,
      tokenId: (spenderHost as Spender).id,
      id: item.id,
      spender: (spenderHost as Spender).id,
    };
  }

  if (item.type === 'nft') {
    const isNftContracts = !!item.nftContract;
    const nftInfo = isNftContracts ? item.nftContract : item.nftToken;
    const abi = nftInfo?.is_erc721
      ? 'ERC721'
      : nftInfo?.is_erc1155
      ? 'ERC1155'
      : '';
    return {
      approvalType: 'nft',
      chainServerId: item?.chain,
      contractId: nftInfo?.contract_id || '',
      spender: (spenderHost as Spender).id,
      nftTokenId: (nftInfo as NFTApproval)?.inner_id || null,
      abi,
      isApprovedForAll: nftInfo && 'inner_id' in nftInfo ? false : true,
    };
  }

  return undefined;
};

export function checkoutContractSpender(
  contractApproval: ContractApprovalItem['list'][number],
) {
  return 'spender' in contractApproval
    ? contractApproval.spender
    : 'spenders' in contractApproval
    ? contractApproval.spenders?.[0]
    : null;
}

export function getFinalRiskInfo(contract: ContractApprovalItem) {
  const eva = contract.$contractRiskEvaluation;
  const finalMaxScore = Math.max(eva.clientMaxRiskScore, eva.serverRiskScore);

  const isDanger = finalMaxScore >= RiskNumMap.danger;
  const isWarning = !isDanger && finalMaxScore >= RiskNumMap.warning;

  return {
    isServerRisk: eva.serverRiskScore >= RiskNumMap.warning,
    // isServerDanger: eva.serverRiskScore >= RiskNumMap.danger,
    // isServerWarning: eva.serverRiskScore >= RiskNumMap.warning,
    isDanger,
    isWarning,
  };
}
export function sortContractListAsTable(
  a: ContractApprovalItem,
  b: ContractApprovalItem,
) {
  const checkResult = checkCompareContractItem(a, b);
  // descending to keep risk-first-return-value
  if (checkResult.shouldEarlyReturn) return -checkResult.comparison;

  return (
    // descending order by client total risk score
    reEvaluateContractRisk(b).totalRiskScore -
      reEvaluateContractRisk(a).totalRiskScore ||
    // ascending order by risk exposure
    a.$riskAboutValues.risk_spend_usd_value -
      b.$riskAboutValues.risk_spend_usd_value ||
    // or descending order by approved count
    b.list.length - a.list.length
  );
}
const RiskNumMapMirrors = Object.entries(approvalUtils.RiskNumMap).reduce(
  (acc, [k, v]) => {
    acc[v] = k;
    return acc;
  },
  { ...approvalUtils.RiskNumMap } as typeof approvalUtils.RiskNumMap &
    ObjectMirror<typeof approvalUtils.RiskNumMap>,
);
export function reEvaluateContractRisk(contract: ContractApprovalItem) {
  const $riskEval = contract.$contractRiskEvaluation;
  const trustValue = (() => {
    const isDanger =
      $riskEval.extra.clientSpendScore >= approvalUtils.RiskNumMap.danger;
    const isWarning =
      !isDanger &&
      $riskEval.extra.clientSpendScore >= approvalUtils.RiskNumMap.warning;

    const isRisky = isDanger || isWarning;

    return { isDanger, isWarning, isRisky };
  })();

  const revokeTrends = (() => {
    const isDanger =
      $riskEval.extra.clientApprovalScore >= approvalUtils.RiskNumMap.danger;
    const isWarning =
      !isDanger &&
      $riskEval.extra.clientApprovalScore >= approvalUtils.RiskNumMap.warning;

    const isRisky = isDanger || isWarning;

    return { isDanger, isWarning, isRisky };
  })();

  // server risk has higher priority
  const totalRiskScore =
    $riskEval.clientTotalRiskScore + $riskEval.serverRiskScore * 100;
  const clientLevel = RiskNumMapMirrors[
    $riskEval.clientMaxRiskScore
  ] as approvalUtils.ApprovalRiskLevel;

  return {
    serverLevel: contract.risk_level as approvalUtils.ApprovalRiskLevel,
    clientLevel,
    totalRiskScore,
    clientTotalRiskScore: $riskEval.clientTotalRiskScore,
    serverRiskScore: $riskEval.serverRiskScore,
    trustValueEvalutation: trustValue,
    revokeTrendsEvaluation: revokeTrends,
  };
}

export function openScanLinkFromChainItem(
  scanLink: Chain['scanLink'] | null | undefined,
  address: string,
) {
  if (!scanLink) return;

  openExternalUrl(getAddressScanLink(scanLink, address));
}

export function openNFTLinkFromChainItem(
  chainOrScanLink: Chain | Chain['scanLink'] | null | undefined,
  address: string,
) {
  const scanLink =
    typeof chainOrScanLink === 'string'
      ? chainOrScanLink
      : chainOrScanLink?.scanLink;
  return openScanLinkFromChainItem(scanLink, address);
}

export function maybeNFTLikeItem(
  contractListItem: ContractApprovalItem['list'][number],
): contractListItem is NFTApproval | NFTApprovalContract {
  return (
    'spender' in contractListItem &&
    (contractListItem.is_erc1155 || contractListItem.is_erc721)
  );
}

export type NFTBadgeType = 'nft' | 'collection';
export function getContractNFTType(
  contractApprovalItem: ContractApprovalItem['list'][number],
) {
  const result = {
    nftBadgeType: null as null | NFTBadgeType,
    isNFTToken: false,
    isNFTCollection: false,
  };

  if ('spender' in contractApprovalItem) {
    const maybeNFTSpender =
      contractApprovalItem.spender as SpenderInNFTApproval;

    result.isNFTCollection = !!maybeNFTSpender.$assetParent?.nftContract;
    result.isNFTToken =
      !result.isNFTCollection && !!maybeNFTSpender.$assetParent?.nftToken;

    result.nftBadgeType = result.isNFTCollection ? 'collection' : 'nft';
  }

  return result;
}
