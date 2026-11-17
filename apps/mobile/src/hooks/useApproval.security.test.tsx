import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { notificationServiceApi } from '@/core/serviceApi/notification';
import { ApprovalIdentityContext } from './approvalIdentity';
import { useApproval } from './useApproval';

jest.mock('@/core/serviceApi/notification', () => ({
  notificationServiceApi: {
    getApproval: jest.fn(),
    resolveApproval: jest.fn(),
  },
  getNotificationWindowIdSnapshot: jest.fn(),
}));
jest.mock('./useApprovalPopup', () => ({
  useApprovalPopup: () => ({
    enablePopup: () => false,
    showPopup: jest.fn(),
    closePopup: jest.fn(),
  }),
}));
jest.mock('./useDeviceConnect', () => ({ useDeviceConnect: () => () => true }));
jest.mock('@/utils/events', () => ({ eventBus: { emit: jest.fn() } }));

const approval = {
  id: 'reviewed',
  data: { approvalComponent: 'SignTypedData' },
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ApprovalIdentityContext.Provider
    value={{ id: 'reviewed', component: 'SignTypedData' }}>
    {children}
  </ApprovalIdentityContext.Provider>
);

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(notificationServiceApi.getApproval)
    .mockResolvedValue(approval as never);
});

test('refuses pending security and binds a successful resolution to the displayed approval', async () => {
  let ready = false;
  const { result } = renderHook(
    () => useApproval({ canResolve: () => ready }),
    { wrapper },
  );
  await act(async () => {
    await result.current[1]({}, true);
  });
  expect(notificationServiceApi.resolveApproval).not.toHaveBeenCalled();
  ready = true;
  await act(async () => {
    await result.current[1]({ signed: true }, true);
  });
  expect(notificationServiceApi.resolveApproval).toHaveBeenCalledWith(
    { signed: true },
    false,
    'reviewed',
  );
});

test.each([
  null,
  { ...approval, id: 'next-request' },
  { ...approval, data: { approvalComponent: 'SignTx' } },
])('refuses a missing or replaced approval: %j', async current => {
  jest
    .mocked(notificationServiceApi.getApproval)
    .mockResolvedValue(current as never);
  const { result } = renderHook(() => useApproval({ canResolve: () => true }), {
    wrapper,
  });
  await act(async () => {
    await result.current[1]({}, true);
  });
  expect(notificationServiceApi.resolveApproval).not.toHaveBeenCalled();
});

test('rechecks the evaluated request after the asynchronous approval lookup', async () => {
  let ready = true;
  jest
    .mocked(notificationServiceApi.getApproval)
    .mockImplementationOnce(async () => {
      ready = false;
      return approval as never;
    });
  const { result } = renderHook(
    () => useApproval({ canResolve: () => ready }),
    { wrapper },
  );
  await act(async () => {
    await result.current[1]({}, true);
  });
  expect(notificationServiceApi.resolveApproval).not.toHaveBeenCalled();
});

test('cannot resolve a gated approval outside its request identity provider', async () => {
  const { result } = renderHook(() => useApproval({ canResolve: () => true }));
  await act(async () => {
    await result.current[1]({}, true);
  });
  expect(notificationServiceApi.resolveApproval).not.toHaveBeenCalled();
});
