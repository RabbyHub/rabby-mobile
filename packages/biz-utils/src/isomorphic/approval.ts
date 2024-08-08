import type {
  NFTApproval,
  NFTApprovalContract,
  Spender,
  TokenApproval,
} from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';

import {
  coerceFloat,
  coerceInteger,
  formatNumber,
  splitNumberByStep,
} from './biz-number';
import type { RevokeSummary } from './permit2';
import { encodePermit2GroupKey } from './permit2';

const approvalEnvs = {
  appIsProd: true,
  appIsDev: false,
};
let setupApprovalEnvs = false;
export function setApprovalEnvsOnce(envs: typeof approvalEnvs) {
  if (!setupApprovalEnvs) {
    Object.assign(approvalEnvs, envs);
    setupApprovalEnvs = true;
  } else {
    throw new Error('approvalEnvs has been setup');
  }
}

export type ApprovalSpenderItemToBeRevoked = {
  chainServerId: ApprovalItem['chain'];
  spender: Spender['id'];
  permit2Id?: string;
} & (
  | {
      contractId: NFTInfoHost['contract_id'];
      isApprovedForAll: boolean;
      tokenId?: '';
      abi: 'ERC721' | 'ERC1155' | '';
      nftTokenId: string | null | undefined;
      nftContractName?: string | null;
    }
  | {
      contractId?: undefined;
      id: TokenApproval['id'] | Spender['id'];
      tokenId?: string | null | undefined;
    }
);

export type ApprovalItem =
  | ContractApprovalItem
  | TokenApprovalItem
  | NftApprovalItem;

export type NFTInfoHost =
  | NFTApproval
  | /* nft (token) */ NFTApprovalContract /* nft-contract */;

export type AssetApprovalItem = TokenApprovalItem | NftApprovalItem;
export type AssetApprovalSpender =
  | TokenApprovalItem['list'][number]
  | NftApprovalItem['list'][number];

export type TokenApprovalIndexedBySpender = TokenApproval & {
  readonly $indexderSpender?: SpenderInTokenApproval;
  readonly $self?: TokenApproval;
};

type ContractFor = 'nft' | 'nft-contract' | 'token';
type GetContractTypeByContractFor<T extends ContractFor> = T extends 'nft'
  ? NFTApproval
  : T extends 'nft-contract'
  ? NFTApprovalContract
  : T extends 'token'
  ? TokenApprovalIndexedBySpender
  : unknown;

export type ContractApprovalItem<T extends ContractFor = ContractFor> = {
  name: string;
  logo_url: string;
  risk_level: string;
  risk_alert?: string;
  id: string;
  type: 'contract';
  contractFor: T;

  list: GetContractTypeByContractFor<T>[];
  chain: string;
  $riskAboutValues: ComputedRiskAboutValues;
  $contractRiskEvaluation: ComputedRiskEvaluation;
};

export type SpenderInTokenApproval = Spender & {
  readonly $assetParent?: TokenApprovalItem;
  readonly $assetToken?: TokenApproval;
  readonly $assetContract?: ContractApprovalItem;
};
export type TokenApprovalItem = {
  name: string;
  logo_url: string;
  risk_level: string;
  risk_alert?: string;
  id: string;
  type: 'token';
  // TODO: could the field be big number?
  balance: number;

  list: SpenderInTokenApproval[];
  chain: string;
  $riskAboutValues: ComputedRiskAboutValues;
};

export type SpenderBalancePartials = {
  from: ContractFor;
  nftAmount: 0;
  tokenBalance: 0;
};
export type SpenderInNFTApproval = Spender & {
  readonly $assetParent?: NftApprovalItem;
  readonly $assetToken?: NFTApproval | NFTApprovalContract;
  readonly $assetContract?: ContractApprovalItem;
};

export type NftApprovalItem = {
  nftContract?: NFTApprovalContract;
  nftToken?: NFTApproval;
} & {
  name: string;
  logo_url: string;
  risk_level: string;
  risk_alert?: string;
  id: string;
  type: 'nft';
  amount: string;

  list: SpenderInNFTApproval[];
  chain: string;
  $riskAboutValues: ComputedRiskAboutValues;
};

export type ComputedRiskAboutValues = {
  /** @deprecated */
  risk_exposure_usd_value: number;
  // is_exposure_usd_value_unknown: boolean;
  risk_spend_usd_value: number;
  approve_user_count: number;
  revoke_user_count: number;
  last_approve_at: number;
};

export type ApprovalRiskLevel = 'safe' | 'warning' | 'danger';
export const RiskNumMap = {
  unknown: 0,
  safe: 1,
  warning: 10,
  danger: 100,
} as const;
type RiskLevelScore = (typeof RiskNumMap)[ApprovalRiskLevel];

export type ComputedRiskEvaluation = {
  serverRiskScore: RiskLevelScore;
  clientMaxRiskScore: RiskLevelScore;
  clientTotalRiskScore: number;

  extra: {
    serverRiskLevel: ApprovalRiskLevel;

    clientSpendLevel: ApprovalRiskLevel;
    clientSpendScore: RiskLevelScore;

    clientApprovalLevel: ApprovalRiskLevel;
    clientApprovalScore: RiskLevelScore;
  };
};

export function isContractType(
  contract: ContractApprovalItem,
  type: 'nft'
): contract is ContractApprovalItem<'nft'>;
export function isContractType(
  contract: ContractApprovalItem,
  type: 'nft-contract'
): contract is ContractApprovalItem<'nft-contract'>;
export function isContractType(
  contract: ContractApprovalItem,
  type: 'token',
): contract is ContractApprovalItem<'token'>;
export function isContractType<T extends ContractFor>(
  contract: ContractApprovalItem,
  type: T
): boolean {
  return contract.contractFor === type;
}

export function makeComputedRiskAboutValues(
  contractFor: ContractFor,
  spender?: Spender,
): ComputedRiskAboutValues {
  if (contractFor === 'nft' || contractFor === 'nft-contract') {
    return {
      risk_exposure_usd_value: coerceFloat(spender?.exposure_nft_usd_value, 0),
      // is_exposure_usd_value_unknown:
      //   spender?.exposure_nft_usd_value === null ||
      //   typeof spender?.exposure_nft_usd_value !== 'number',
      risk_spend_usd_value: coerceFloat(spender?.spend_usd_value, 0),
      approve_user_count: coerceInteger(spender?.approve_user_count, 0),
      revoke_user_count: coerceInteger(spender?.revoke_user_count, 0),
      last_approve_at: coerceInteger(spender?.last_approve_at, 0),
    };
  }

  return {
    risk_exposure_usd_value: coerceFloat(spender?.exposure_usd_value, 0),
    // is_exposure_usd_value_unknown:
    //   spender?.exposure_usd_value === null ||
    //   typeof spender?.exposure_usd_value !== 'number',
    risk_spend_usd_value: coerceFloat(spender?.spend_usd_value, 0),
    approve_user_count: coerceInteger(spender?.approve_user_count, 0),
    revoke_user_count: coerceInteger(spender?.revoke_user_count, 0),
    last_approve_at: coerceInteger(spender?.last_approve_at, 0),
  };
}

export function getContractRiskEvaluation(
  risk_level: ApprovalRiskLevel | string,
  riskValues: ComputedRiskAboutValues
): ComputedRiskEvaluation {
  const serverRiskLevel = risk_level as ApprovalRiskLevel;
  const serverRiskScore = coerceInteger(
    RiskNumMap[serverRiskLevel],
    0
  ) as RiskLevelScore;

  // const exposureValue = coerceFloat(riskValues.risk_exposure_usd_value);
  const spendValue = coerceFloat(riskValues.risk_spend_usd_value);
  const clientSpendLevel: ApprovalRiskLevel =
    spendValue < 1e4 ? 'danger' : spendValue < 1e5 ? 'warning' : 'safe';
  const clientSpendScore = coerceInteger(
    RiskNumMap[clientSpendLevel],
    0
  ) as RiskLevelScore;

  const approve_user_count = coerceInteger(
    riskValues.approve_user_count
  ) as RiskLevelScore;
  const revoke_user_count = coerceInteger(
    riskValues.revoke_user_count
  ) as RiskLevelScore;

  const clientApprovalLevel: ApprovalRiskLevel =
    revoke_user_count < 10
      ? 'safe'
      : revoke_user_count > approve_user_count * 4
      ? 'danger'
      : revoke_user_count > approve_user_count * 2
      ? 'warning'
      : 'safe';

  const clientApprovalScore = coerceInteger(
    RiskNumMap[clientApprovalLevel],
    0
  ) as RiskLevelScore;

  const allClientScores = [clientSpendScore, clientApprovalScore];

  const clientMaxRiskScore = Math.max(...allClientScores) as RiskLevelScore;

  const clientTotalRiskScore = allClientScores.reduce(
    (acc, cur) => (acc + cur) as RiskLevelScore,
    0
  );

  return {
    serverRiskScore,
    clientTotalRiskScore,
    clientMaxRiskScore,

    extra: {
      serverRiskLevel,

      clientSpendLevel,
      clientSpendScore,

      clientApprovalLevel,
      clientApprovalScore,
    },
  };
}

/**
 * @description compare contract approval item by risk score,
 * it's supposed to make descending order
 *
 * if a's risk score greater than b's, return 1
 * if a's risk score less than b's, return -1
 * if a's risk score equal to b's, return 0
 *
 * @param a
 * @param b
 */
export function compareContractApprovalItemByRiskLevel(
  a: ContractApprovalItem,
  b: ContractApprovalItem
) {
  const aRisk =
    a.$contractRiskEvaluation ||
    getContractRiskEvaluation(a.risk_level, a.$riskAboutValues);
  const bRisk =
    b.$contractRiskEvaluation ||
    getContractRiskEvaluation(b.risk_level, a.$riskAboutValues);

  // some times, server risk score is null, so we need to compare client risk score
  if (
    aRisk.serverRiskScore &&
    bRisk.serverRiskScore &&
    aRisk.serverRiskScore !== bRisk.serverRiskScore
  ) {
    return aRisk.serverRiskScore > bRisk.serverRiskScore ? 1 : -1;
  }

  // if (aRisk.clientTotalRiskScore !== bRisk.clientTotalRiskScore) {
  //   return aRisk.clientTotalRiskScore > bRisk.clientTotalRiskScore ? 1 : -1;
  // }

  // if (aRisk.clientMaxRiskScore !== bRisk.clientMaxRiskScore) {
  //   return aRisk.clientMaxRiskScore > bRisk.clientMaxRiskScore ? 1 : -1;
  // }

  return 0;
}

export function markContractTokenSpender(
  orig: TokenApproval,
  spender: Spender
): TokenApprovalIndexedBySpender {
  const tokenApproval = { ...orig };
  // eslint-disable-next-line no-prototype-builtins
  if (!tokenApproval.hasOwnProperty('$indexderSpender')) {
    Object.defineProperty(tokenApproval, '$indexderSpender', {
      enumerable: false,
      configurable: approvalEnvs.appIsProd,
      get() {
        return spender;
      },
    });
  }

  // eslint-disable-next-line no-prototype-builtins
  if (!tokenApproval.hasOwnProperty('$self')) {
    Object.defineProperty(tokenApproval, '$self', {
      enumerable: false,
      configurable: approvalEnvs.appIsProd,
      get() {
        return orig;
      },
    });
  }

  return tokenApproval as TokenApprovalIndexedBySpender;
}

export function markParentForAssetItemSpender(
  spender: Spender,
  parent: AssetApprovalItem,
  assetContract: ContractApprovalItem,
  assetToken: TokenApproval | NFTApproval | NFTApprovalContract
) {
  Object.defineProperty(spender, '$assetParent', {
    enumerable: false,
    configurable: approvalEnvs.appIsProd,
    get() {
      return parent;
    },
  });
  Object.defineProperty(spender, '$assetContract', {
    enumerable: false,
    configurable: approvalEnvs.appIsProd,
    get() {
      return assetContract;
    },
  });
  Object.defineProperty(spender, '$assetToken', {
    enumerable: false,
    configurable: approvalEnvs.appIsProd,
    get() {
      return assetToken;
    },
  });

  return spender;
}

export function getSpenderBalancePartials(spender: AssetApprovalSpender) {
  const partials = {
    from: 'token' as ContractFor,
    isNFT: false,
    isNFTCollection: false,
    nftAmount: 0,
    tokenBalance: 0,
  };

  if (spender.$assetParent?.type === 'nft') {
    partials.isNFT = true;

    if (spender.$assetParent?.nftContract) {
      partials.from = 'nft-contract';
      partials.nftAmount = coerceInteger(spender.$assetParent?.nftContract.amount, 0);
    } else if (spender.$assetParent?.nftToken) {
      if (spender.$assetParent?.nftToken?.is_erc1155) {
        partials.from = 'nft-contract';
        partials.nftAmount = coerceInteger(spender.$assetParent?.nftToken.amount, 0);
      } else if (spender.$assetParent?.nftToken?.is_erc721) {
        partials.nftAmount = 1;
      }
    }
  } else if (spender.$assetParent?.type === 'token') {
    partials.tokenBalance = coerceFloat(spender.$assetParent?.balance);
  } else if (approvalEnvs.appIsDev) {
    console.debug('unknown type spender', spender);
  }

  return {
    ...partials,
    balanceValue: partials.from === 'token' ? partials.tokenBalance : partials.nftAmount,
  };
}
type AmountPartialsType = ReturnType<typeof getSpenderBalancePartials>;

/**
 * @debug test account 0x364acfceaf895aa369170f2b2237695e342e15aa
 */
export function getSpenderApprovalAmount(spender: AssetApprovalSpender) {
  let absValue = spender.value || 0;
  let bigValue = new BigNumber(absValue);

  const isUnlimited = bigValue.gte(10 ** 9);
  let displayAmountText = '';
  let displayAmountUnitText = '';
  let displayBalanceText = '';
  let nftOrderScore = 0;

  if (spender.$assetParent?.type === 'nft') {
    absValue = 1;
    bigValue = new BigNumber(absValue);

    if (spender.$assetParent?.nftContract) {
      displayAmountText = displayAmountUnitText = '1 Collection';
      const nftCount =
        (spender.$assetToken && 'amount' in spender.$assetToken
          ? spender.$assetToken.amount
          : spender.$assetParent?.nftContract.amount) || 0;
      displayBalanceText = nftCount
        ? `${formatNumber(nftCount, 0)} ${
            coerceInteger(nftCount) > 1 ? 'NFTs' : 'NFT'
          }`
        : '-';

      if (spender.$assetParent?.nftContract?.is_erc1155) {
        nftOrderScore = 102;
      } else if (spender.$assetParent?.nftContract?.is_erc721) {
        nftOrderScore = 101;
      }
    } else if (spender.$assetParent?.nftToken) {
      if (spender.$assetParent?.nftToken?.is_erc1155) {
        displayAmountText = displayAmountUnitText = '1 Collection';
        displayBalanceText = '1 Collection';
        nftOrderScore = 202;
      } else if (spender.$assetParent?.nftToken?.is_erc721) {
        displayAmountText = displayAmountUnitText = '1 NFT';
        displayBalanceText = '1 NFT';
        nftOrderScore = 201;
      }
    }
  } else if (spender.$assetParent?.type === 'token') {
    const stepNumberText = splitNumberByStep(bigValue.toFixed(2));
    if (isUnlimited) {
      displayAmountText = displayAmountUnitText = 'Unlimited';
    } else {
      displayAmountText = stepNumberText;
      displayAmountUnitText = `${stepNumberText} ${spender.$assetParent?.name || ''}`;
    }

    const absBalance = spender.$assetParent?.balance;
    displayBalanceText = `${
      typeof absBalance === 'number'
        ? formatNumber(absBalance)
        : absBalance || '-'
    }`;
  } else if (approvalEnvs.appIsDev) {
    console.debug('unknown type spender', spender);
  }

  return {
    bigValue,
    isUnlimited,
    displayAmountText,
    displayAmountUnitText,
    displayBalanceText,
    nftOrderScore,
    get spender() {
      return spender;
    },
  };
}

/**
 * @description compare contract approval item by approved amount,
 * it's supposed to make descending order
 *
 * if a's risk score greater than b's, return 1
 * if a's risk score less than b's, return -1
 * if a's risk score equal to b's, return 0
 *
 * @param a
 * @param b
 */
export function compareAssetSpenderByAmount(
  a: AssetApprovalSpender,
  b: AssetApprovalSpender
) {
  const aApprovedAmount = getSpenderApprovalAmount(a);
  const bApprovedAmount = getSpenderApprovalAmount(b);

  if (!aApprovedAmount.bigValue.eq(bApprovedAmount.bigValue)) {
    return aApprovedAmount.bigValue.gt(bApprovedAmount.bigValue) ? 1 : -1;
  }

  return aApprovedAmount.nftOrderScore > bApprovedAmount.nftOrderScore ? 1 : -1;
}

const enum AssetTypeScores {
  token = 9999,
  colletion = 1000,
  nft = 100,
  unknown = 0,
}

function getAssetSpenderTypeOrderScore(spender: AssetApprovalSpender) {
  let score = AssetTypeScores.unknown;
  if (spender.$assetParent?.type === 'token') {
    return AssetTypeScores.token;
  }

  if (spender.$assetParent?.type === 'nft') {
    const nftInfoHost =
      spender.$assetParent?.nftContract || spender.$assetParent?.nftToken;
    if (nftInfoHost?.is_erc1155) {
      score = AssetTypeScores.colletion;
    } else if (nftInfoHost?.is_erc721) {
      score = AssetTypeScores.nft;
    } else {
      score = AssetTypeScores.unknown;
    }
  }

  return AssetTypeScores.unknown;
}

/**
 * @description compare contract approval item by its type,
 * it's supposed to make descending order
 *
 * if a's risk score greater than b's, return 1
 * if a's risk score less than b's, return -1
 * if a's risk score equal to b's, return 0
 *
 * @param a
 * @param b
 */
export function compareAssetSpenderByType(
  a: AssetApprovalSpender,
  b: AssetApprovalSpender,
) {
  const aScore = getAssetSpenderTypeOrderScore(a);
  const bScore = getAssetSpenderTypeOrderScore(b);

  if (aScore !== bScore) {
    return aScore > bScore ? 1 : -1;
  }

  return 0;
}

export function summarizeRevoke(revokeList: ApprovalSpenderItemToBeRevoked[]) {
  const { statics, permit2Revokes, generalRevokes } = revokeList.reduce(
    (accu, cur) => {
      accu.statics.spenderCount += 1;
      if ('permit2Id' in cur && cur.permit2Id) {
        const { permit2Id } = cur;
        const permit2Key = encodePermit2GroupKey(cur.chainServerId, permit2Id);
        if (!accu.permit2Revokes[permit2Key]) {
          accu.permit2Revokes[permit2Key] = accu.permit2Revokes[permit2Key] || {
            chainServerId: cur.chainServerId,
            // contractId: cur.contractId,
            permit2Id,
            tokenSpenders: [],
          };
        }

        if ('tokenId' in cur && cur.tokenId) {
          accu.permit2Revokes[permit2Key].tokenSpenders.push({
            spender: cur.spender,
            token: cur.tokenId,
          });
        }
        // accu.permit2Revokes[permit2Key].push(cur);
      } else {
        accu.generalRevokes.push(cur);
      }

      return accu;
    },
    {
      generalRevokes: [],
      permit2Revokes: {},
      statics: {
        txCount: 0,
        spenderCount: 0,
      },
    } as RevokeSummary,
  );

  statics.txCount =
    generalRevokes.length +
    Object.values(permit2Revokes).filter(
      revokes => revokes.tokenSpenders.length > 0,
    ).length;

  return {
    // $originalList: revokeList,
    statics,
    generalRevokes,
    permit2Revokes,
  };
}
