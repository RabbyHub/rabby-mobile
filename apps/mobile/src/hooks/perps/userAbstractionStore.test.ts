import type { Account } from '@/core/startupServices/preference';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@/core/apis/perps', () => ({ apisPerps: {} }));
// Resolving the snapshot now persists the mode; stub the deferred service so
// the store test does not depend on (or log about) the service registry.
jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getUserAbstractionForAddress: jest.fn(async () => null),
    setUserAbstractionForAddress: jest.fn(async () => undefined),
    clearUserAbstractionForAddress: jest.fn(async () => undefined),
  },
}));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/core/utils/startupScheduler', () => ({
  runStartupTask: jest.fn(),
  scheduleStartupTask: jest.fn(),
}));
jest.mock('@/utils/events', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), removeAllListeners: jest.fn() },
  EVENTS: { PERPS: {} },
}));

import {
  getPerpsAccountRuntimeContext,
  initialState,
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
  reconcileUserAbstractionSnapshot,
} from './usePerpsStore';

const ACCOUNT_A = {
  address: '0x1111111111111111111111111111111111111111',
  brandName: 'Rabby',
  type: 'PrivateKeyring',
} as Account;
const ACCOUNT_B = {
  address: '0x2222222222222222222222222222222222222222',
  brandName: 'Rabby',
  type: 'PrivateKeyring',
} as Account;

const switchAccount = (account: Account) => {
  perpsStore.setState({
    currentPerpsAccount: account,
    userAbstraction: UserAbstractionResp.default,
    userAbstractionOwnerAddress: null,
    userAbstractionReady: false,
  });
};

describe('Perps Store user abstraction ownership', () => {
  beforeEach(() => {
    perpsStore.setState({ ...initialState });
  });

  it('keeps a previous account snapshot out of the current Store state', () => {
    switchAccount(ACCOUNT_A);
    const runtimeA = getPerpsAccountRuntimeContext();
    switchAccount(ACCOUNT_B);
    const runtimeB = getPerpsAccountRuntimeContext();

    expect(
      reconcileUserAbstractionSnapshot({
        account: ACCOUNT_A,
        generation: runtimeA.generation,
        userAbstraction: UserAbstractionResp.default,
      }),
    ).toBe(false);
    expect(
      reconcileUserAbstractionSnapshot({
        account: ACCOUNT_B,
        generation: runtimeB.generation,
        userAbstraction: UserAbstractionResp.unifiedAccount,
      }),
    ).toBe(true);

    const state = perpsStore.getState();
    expect(state.userAbstraction).toBe(UserAbstractionResp.unifiedAccount);
    expect(state.userAbstractionOwnerAddress).toBe(ACCOUNT_B.address);
    expect(isPerpsUserAbstractionReadyForAccount(state)).toBe(true);
  });

  it('invalidates the first A snapshot across an A to B to A Runtime cycle', () => {
    switchAccount(ACCOUNT_A);
    const firstRuntimeA = getPerpsAccountRuntimeContext();
    switchAccount(ACCOUNT_B);
    switchAccount(ACCOUNT_A);
    const secondRuntimeA = getPerpsAccountRuntimeContext();

    expect(
      reconcileUserAbstractionSnapshot({
        account: ACCOUNT_A,
        generation: firstRuntimeA.generation,
        userAbstraction: UserAbstractionResp.default,
      }),
    ).toBe(false);
    expect(
      reconcileUserAbstractionSnapshot({
        account: ACCOUNT_A,
        generation: secondRuntimeA.generation,
        userAbstraction: UserAbstractionResp.unifiedAccount,
      }),
    ).toBe(true);

    expect(perpsStore.getState()).toMatchObject({
      currentPerpsAccount: ACCOUNT_A,
      userAbstraction: UserAbstractionResp.unifiedAccount,
      userAbstractionOwnerAddress: ACCOUNT_A.address,
      userAbstractionReady: true,
    });
  });

  it('fails closed for an unknown current-account abstraction response', () => {
    switchAccount(ACCOUNT_A);
    const runtime = getPerpsAccountRuntimeContext();
    perpsStore.setState({
      userAbstraction: UserAbstractionResp.default,
      userAbstractionOwnerAddress: ACCOUNT_A.address,
      userAbstractionReady: true,
    });

    expect(
      reconcileUserAbstractionSnapshot({
        account: ACCOUNT_A,
        generation: runtime.generation,
        userAbstraction: 'unexpected-mode',
      }),
    ).toBe(true);
    expect(perpsStore.getState()).toMatchObject({
      userAbstractionOwnerAddress: null,
      userAbstractionReady: false,
    });
  });
});
