const mockSend = jest.fn();

jest.mock('@/utils/transaction', () => ({
  calcMaxPriorityFee: jest.fn(),
  checkGasAndNonce: jest.fn(() => []),
  convertLegacyTo1559: (tx: unknown) => tx,
}));
jest.mock('@/utils/number', () => ({
  intToHex: (value: unknown) => value,
}));
jest.mock('@/utils/chain', () => ({
  findChain: jest.fn(),
  isTestnet: jest.fn(() => false),
}));
jest.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));
jest.mock('@/utils/time', () => ({ getTimeSpan: jest.fn() }));
jest.mock('@/utils/hyperEvm', () => ({
  isHyperEvmChain: jest.fn(() => false),
}));
jest.mock('@/utils/ledger', () => ({
  isLedgerLockError: () => false,
}));
jest.mock('@/utils/tempo', () => ({
  buildTempoTransaction: jest.fn(),
  isTempoBatchSupportedAccountType: jest.fn(() => false),
  isTempoChain: jest.fn(() => false),
  shouldUseTempoTransaction: jest.fn(() => false),
  toTempoCallsTx: jest.fn(),
}));
jest.mock('@/core/utils/linking', () => ({
  openExternalUrl: jest.fn(),
}));
jest.mock('@/core/request', () => ({ openapi: {}, testOpenapi: {} }));
jest.mock('@/core/utils/blockedAddress', () => ({
  getTxAddressesToCheck: jest.fn(),
  hasBlockedAddress: jest.fn(),
}));
jest.mock('@/core/apis', () => ({
  apiCustomRPC: {},
  apiKeyring: {},
  apiProvider: {},
}));
jest.mock('@/core/apis/transactions', () => ({ calcGasLimit: jest.fn() }));
jest.mock('@/core/apis/securityEngine', () => ({
  executeSecurityEngine: jest.fn(),
}));
jest.mock('@/core/apis/transactionHistory', () => ({
  apisTransactionHistory: {},
}));
jest.mock('@/core/apis/provider', () => ({ requestETHRpc: jest.fn() }));
jest.mock('@/core/serviceApi/keyring', () => ({ keyringServiceApi: {} }));
jest.mock('@/core/serviceApi/gasAccount', () => ({
  gasAccountServiceApi: { getGasAccountSig: jest.fn() },
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {},
}));
jest.mock('@/core/serviceApi/whitelist', () => ({ whitelistServiceApi: {} }));
jest.mock('@/core/serviceApi/customRPC', () => ({ customRPCServiceApi: {} }));
jest.mock('@/core/serviceApi/misc', () => ({
  miscServiceApi: { setCurrentGasLevel: jest.fn() },
}));
jest.mock('@/constant', () => ({ INTERNAL_REQUEST_ORIGIN: 'rabby' }));
jest.mock('@/constant/gas', () => ({
  ALIAS_ADDRESS: {},
  CAN_ESTIMATE_L1_FEE_CHAINS: [],
}));
jest.mock('@/constant/tx', () => ({ SUPPORT_1559_KEYRING_TYPE: [] }));
jest.mock('@/hooks/useCexSupportList', () => ({ getCexInfo: jest.fn() }));
jest.mock('@/components/Approval/components/SignTx/calc', () => ({
  explainGas: jest.fn(),
  getGasTokenBalance: jest.fn(),
  getRecommendNonce: jest.fn(),
}));
jest.mock('@/components/Approval/components/SignTx/getRecommendGas', () => ({
  getRecommendGas: jest.fn(),
}));
jest.mock('@/components/Approval/components/SignTx/util', () => ({
  normalizeTxParams: jest.fn(),
}));
jest.mock(
  '@/components/Approval/components/TxComponents/GasSelector/approvalGasDisplay',
  () => ({
    shouldAutoSwitchToApprovalGasAccount: jest.fn(),
  }),
);
jest.mock('../domain/gasSelection', () => ({
  computeCustomGasPrice: jest.fn(),
  selectInitialGas: jest.fn(),
}));
jest.mock('../domain/ctx', () => ({ buildFingerprint: jest.fn() }));
jest.mock('../state/gasPaymentState', () => ({
  resolveMiniSignSubmitGasMode: jest.fn(),
}));
jest.mock('@/utils/sendTransaction', () => ({
  FailedCode: {
    UserRejected: 'UserRejected',
    SubmitTxFailed: 'SubmitTxFailed',
  },
  sendTransactionByMiniSignV2: (...args: unknown[]) => mockSend(...args),
}));
jest.mock('@/utils/errorTxRetry', () => ({
  getRetryTxRecommendNonce: jest.fn(),
  getRetryTxType: jest.fn(),
  retryTxReset: jest.fn(async () => undefined),
  setRetryTxRecommendNonce: jest.fn(async () => undefined),
}));
jest.mock('i18next', () => {
  const i18n = {
    t: (key: string) => key,
    use: () => i18n,
    init: () => Promise.resolve(),
    changeLanguage: () => Promise.resolve(),
  };
  return { __esModule: true, default: i18n, t: (key: string) => key };
});

import { SignatureSteps } from './SignatureSteps';
import { setRetryTxRecommendNonce } from '@/utils/errorTxRetry';

const sendBatch = (nonce = '0x1') =>
  SignatureSteps.sendBatch({
    chainServerId: 'eth',
    txsCalc: [
      {
        tx: {
          from: '0x1111111111111111111111111111111111111111',
          chainId: 1,
          nonce,
        },
      } as any,
    ],
    selectedGas: null,
    options: {} as any,
    onSendedTx: () => undefined,
    account: {
      type: 'Onekey Hardware',
      address: '0x1111111111111111111111111111111111111111',
    } as any,
  });

describe('SignatureSteps OneKey disconnect nonce', () => {
  beforeEach(() => {
    mockSend.mockReset();
    (setRetryTxRecommendNonce as jest.Mock).mockClear();
  });

  it.each([107, 109])(
    'does not bump nonce when Device interrupted keeps code %s',
    async code => {
      mockSend.mockRejectedValue(
        Object.assign(new Error('Device interrupted'), {
          code,
          name: 'SubmitTxFailed',
        }),
      );

      const result = await sendBatch();

      expect(setRetryTxRecommendNonce).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            description: 'Device interrupted',
          }),
        }),
      );
    },
  );

  it('bumps nonce when Device interrupted has no SDK code', async () => {
    mockSend.mockRejectedValue(new Error('Device interrupted'));

    await sendBatch('0x2');

    expect(setRetryTxRecommendNonce).toHaveBeenCalledTimes(1);
  });
});
