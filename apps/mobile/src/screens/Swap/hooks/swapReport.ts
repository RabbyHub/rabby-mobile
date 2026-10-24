import * as Sentry from '@sentry/react-native';
import type {
  VerifySdkParams,
  VerifySdkResult,
} from '@rabby-wallet/rabby-swap';

type SwapSdkVerificationReportParams = Pick<
  VerifySdkParams,
  'chain' | 'dexId' | 'payTokenId' | 'receiveTokenId'
> & {
  result: Pick<
    VerifySdkResult,
    'routerPass' | 'spenderPass' | 'callDataPass' | 'receiverPass'
  >;
};

export const reportSwapSdkVerification = ({
  chain,
  dexId,
  payTokenId,
  receiveTokenId,
  result,
}: SwapSdkVerificationReportParams) => {
  const addressFailures = [
    ...(!result.routerPass ? ['router'] : []),
    ...(!result.spenderPass ? ['spender'] : []),
  ];
  // Address failures take priority over dependent calldata checks.
  const category = addressFailures.length ? 'address' : 'calldata';
  const failed = addressFailures.length
    ? addressFailures
    : [
        ...(!result.callDataPass ? ['calldata'] : []),
        ...(!result.receiverPass ? ['receiver'] : []),
      ];
  if (!failed.length) {
    return;
  }

  Sentry.captureException(new Error(`swap ${category} verification failed`), {
    level: 'warning',
    tags: {
      swap_dex: dexId,
      swap_chain: chain,
      swap_verify_category: category,
      swap_verify_failed: failed.join(','),
      swap_token_pair: `${payTokenId}/${receiveTokenId}`,
    },
    fingerprint: ['swap-verify-sdk', category],
  });
};
