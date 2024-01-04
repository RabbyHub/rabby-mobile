/**
 * Mapping of RPC name to supported event group name
 */
const rpcToEventGroupMap = new Map([
  ['eth_sign', 'signingEvent'],
  ['personal_sign', 'signingEvent'],
  ['eth_signTypedData', 'signingEvent'],
  ['eth_signTypedData_v3', 'signingEvent'],
  ['eth_signTypedData_v4', 'signingEvent'],
]);

/**
 * check if the rpcName is whitelisted to track the event stage.
 */
export const isWhitelistedRPC = (rpcName: string): boolean =>
  rpcToEventGroupMap.has(rpcName);

/**
 * Deference stage in RPC flow
 */
export enum RPCStageTypes {
  IDLE = 'idle',
  REQUEST_SEND = 'request_send',
  COMPLETE = 'complete',
  ERROR = 'error',
}

/**
 * Defined the event stage properties to be stored in store
 * Different event group will have different eventStage
 */
export interface iEventStage {
  /** @description the current stage of the event flow */
  eventStage: string;
  /** @description the RPC name which fires the event */
  rpcName: string;
  /** @description optional error object to be set in store */
  error?: Error;
}

/**
 * Interface for defining what properties will be defined in store
 * please extend this interface to add more supported RPC events
 */
export interface iEventGroup {
  signingEvent: iEventStage;
}
