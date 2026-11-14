import { NotificationService } from './notification';
import { waitSignComponentAmounted } from '../utils/signEvent';

jest.mock('./appWin', () => ({
  apisAppWin: { globalBottomSheetModalAddListener: jest.fn() },
}));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

const createService = () =>
  new NotificationService({
    preferenceService: {},
    transactionHistoryService: {
      removeSigningTx: jest.fn(),
      removeAllSigningTx: jest.fn(),
    },
  } as any);

const waitingApproval = (id: string, signingOperationId: string) =>
  ({
    id,
    data: {
      approvalComponent: 'LedgerHardwareWaiting',
      params: { signingOperationId },
    },
  } as any);

test('runs a retry only for the operation that registered it', async () => {
  const service = createService();
  const retry = jest.fn().mockResolvedValue('0xsignature-a');
  service.setCurrentRequestDeferFn(retry, 'operation-a');

  await expect(
    service.callCurrentRequestDeferFn(true, 'operation-b'),
  ).resolves.toBeUndefined();
  expect(retry).not.toHaveBeenCalled();

  await expect(
    service.callCurrentRequestDeferFn(true, 'operation-a'),
  ).resolves.toBe('0xsignature-a');
  expect(retry).toHaveBeenCalledWith(true);
});

test('cancelling an operation invalidates only its own retry callback', async () => {
  const service = createService();
  const approvalA = waitingApproval('approval-a', 'operation-a');
  const approvalB = waitingApproval('approval-b', 'operation-b');
  service.approvals = [approvalA, approvalB];
  service.currentApproval = approvalA;
  const retryA = jest.fn().mockResolvedValue(undefined);
  const retryB = jest.fn().mockResolvedValue(undefined);
  service.setCurrentRequestDeferFn(retryA, 'operation-a');
  const pendingMount = waitSignComponentAmounted('operation-a');

  service.deleteApproval(approvalA);
  await expect(pendingMount).resolves.toBe(false);
  await expect(
    service.callCurrentRequestDeferFn(true, 'operation-a'),
  ).resolves.toBeUndefined();
  expect(retryA).not.toHaveBeenCalled();

  service.setCurrentRequestDeferFn(retryB, 'operation-b');
  service.deleteApproval(approvalA);
  await service.callCurrentRequestDeferFn(true, 'operation-b');
  expect(retryB).toHaveBeenCalledWith(true);
});
