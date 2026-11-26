import type {
  ExchangeClient,
  TwapSubmissionOutcome,
} from '@rabby-wallet/hyperliquid-sdk';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import {
  getPerpsRuntimeIdentity,
  type PerpsRuntimeSnapshot,
} from '@/hooks/perps/runtime/perpsRuntimeState';
import type { PerpsAccountRuntimeContext } from '@/hooks/perps/usePerpsStore';
import type { PerpsTwapRecord } from '@/hooks/perps/twap/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

export type PerpsProCancelTwapCommand = Readonly<{
  type: 'cancelTwap';
  account: Readonly<Pick<Account, 'address' | 'type'>>;
  accountGeneration: number;
  runtimeGeneration: number;
  runtimeIdentity: string;
  key: string;
  coin: string;
  twapId: number;
}>;

export const buildPerpsProCancelTwapCommand = (
  order: PerpsTwapRecord,
  accountRuntime: PerpsAccountRuntimeContext,
  runtime: PerpsRuntimeSnapshot,
): PerpsProCancelTwapCommand | null => {
  const account = accountRuntime.account;
  if (
    !order.active ||
    !account ||
    !isSameAddress(order.state.user, account.address) ||
    !accountRuntime.isInitialized ||
    runtime.status !== 'ready' ||
    runtime.identity !== getPerpsRuntimeIdentity(account)
  )
    return null;
  return Object.freeze({
    type: 'cancelTwap',
    account: Object.freeze({ address: account.address, type: account.type }),
    accountGeneration: accountRuntime.generation,
    runtimeGeneration: runtime.generation,
    runtimeIdentity: runtime.identity,
    key: order.key,
    coin: order.state.coin,
    twapId: order.twapId,
  });
};

export type PerpsProCancelTwapContext = {
  accountRuntime: PerpsAccountRuntimeContext;
  runtime: PerpsRuntimeSnapshot;
  hasPermission: boolean;
  order: PerpsTwapRecord | null;
  activeReady: boolean;
};

export const isPerpsProCancelTwapContextCurrent = (
  command: PerpsProCancelTwapCommand,
  context: PerpsProCancelTwapContext,
) =>
  context.hasPermission &&
  context.activeReady &&
  context.accountRuntime.isInitialized &&
  context.accountRuntime.generation === command.accountGeneration &&
  isSamePerpsActionAccount(context.accountRuntime.account, command.account) &&
  context.runtime.status === 'ready' &&
  context.runtime.generation === command.runtimeGeneration &&
  context.runtime.identity === command.runtimeIdentity &&
  context.order?.active === true &&
  context.order.key === command.key &&
  context.order.twapId === command.twapId &&
  context.order.state.coin === command.coin;

const consumed = new WeakSet<PerpsProCancelTwapCommand>();
export const executePerpsProCancelTwap = async (
  command: PerpsProCancelTwapCommand,
  dependencies: {
    getContext: () => PerpsProCancelTwapContext;
    submit: ExchangeClient['cancelTwapOrderWithOutcome'];
  },
): Promise<TwapSubmissionOutcome> => {
  const guard = () =>
    isPerpsProCancelTwapContextCurrent(command, dependencies.getContext());
  if (
    consumed.has(command) ||
    !Object.isFrozen(command) ||
    !Object.isFrozen(command.account) ||
    !guard()
  )
    return { kind: 'contextChanged', phase: 'entry' };
  consumed.add(command);
  return dependencies.submit(
    { coin: command.coin, twapId: command.twapId },
    { isContextCurrent: guard },
  );
};
