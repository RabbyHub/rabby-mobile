import { urlUtils } from "@rabby-wallet/base-utils";

import type { ApprovalSpenderItemToBeRevoked } from "./approval";

// https://github.com/Uniswap/permit2/blob/cc56ad0f3439c502c246fc5cfcc3db92bb8b7219/src/interfaces/IAllowanceTransfer.sol#L89
export type TokenSpenderPair = {
  // the token the spender is approved
  token: string;
  // the spender address
  spender: string;
};

export type RevokeSummary = {
  generalRevokes: ApprovalSpenderItemToBeRevoked[];
  permit2Revokes: {
    [permit2Id: string]: {
      contractId: string;
      permit2Id: string;
      chainServerId: string;
      // if length > 0, batch revoke
      tokenSpenders: TokenSpenderPair[];
    };
  };
  statics: {
    txCount: number;
    spenderCount: number;
  };
};

export function encodePermit2GroupKey(
  chainServerId: string,
  permit2ContractId: string
) {
  return urlUtils.obj2query({ chainServerId, permit2ContractId });
}

export function decodePermit2GroupKey(key: string) {
  const { chainServerId, permit2ContractId } = (urlUtils.query2obj(key) || {}) as {
    chainServerId?: string;
    permit2ContractId?: string;
  };
  return { chainServerId, permit2ContractId };
}
