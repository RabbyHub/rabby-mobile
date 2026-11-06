import * as Sentry from '@sentry/react-native';
import * as bridgeSdk from '@rabby-wallet/rabby-bridge';
import type {
  BridgeApi,
  BridgeBuildTxParams,
  BridgeQuoteListParams,
} from '@rabby-wallet/rabby-bridge';

type BridgeSdkErrorDetail = {
  error_code: string;
  stage: string;
  blocking?: boolean;
  operation?: string;
  aggregatorId?: string;
  chainId?: string;
  toChainId?: string;
  bridgeId?: string;
  method?: string;
  selector?: string;
  routerSelector?: string;
  protocolSelector?: string;
  destinationSelectors?: string[];
  hasDestinationCall?: boolean;
  commandByte?: number;
  unverifiedFields?: string[];
};
type BridgeSdkReport = {
  error_code: string;
  stage: string;
  errors: BridgeSdkErrorDetail[];
};

// shortcut: 0.0.12 has no reporter; remove this optional surface after the SDK upgrade.
const reportingSdk = bridgeSdk as typeof bridgeSdk & {
  toBridgeErrorReport?: (value: unknown) => BridgeSdkReport | undefined;
};

// Keep only diagnostic paths for this app process, never transaction or wallet identities.
const reportedCalldataFailures = new Set<string>();
const calldataFailureKey = (detail: BridgeSdkErrorDetail) =>
  JSON.stringify([
    detail.aggregatorId,
    detail.chainId,
    detail.toChainId,
    detail.bridgeId,
    detail.method,
    detail.selector,
    detail.routerSelector,
    detail.protocolSelector,
    [...new Set(detail.destinationSelectors || [])].sort(),
    Boolean(detail.hasDestinationCall),
    detail.commandByte,
    detail.error_code,
    [...new Set(detail.unverifiedFields || [])].sort(),
  ]);

const reportBridgeSdkError = (value: unknown) => {
  try {
    const report = reportingSdk.toBridgeErrorReport?.(value);
    if (!report) {
      return;
    }
    const pendingKeys = new Set<string>();
    const errors = report.errors.filter(detail => {
      if (
        detail.stage !== 'contract' &&
        (detail.blocking !== false ||
          !['buildTx', 'verifyTx'].includes(detail.operation || '') ||
          detail.stage === 'provider_request')
      ) {
        return false;
      }
      const key = calldataFailureKey(detail);
      if (reportedCalldataFailures.has(key) || pendingKeys.has(key)) {
        return false;
      }
      pendingKeys.add(key);
      return true;
    });
    const detail = errors[0];
    if (!detail) {
      return;
    }
    const payload = {
      ...report,
      error_code: detail.error_code,
      stage: detail.stage,
      errors,
    };
    Sentry.captureException(new Error('bridge SDK validation failed'), {
      level: 'warning',
      tags: {
        bridge_error_code: payload.error_code,
        bridge_error_stage: payload.stage,
        bridge_aggregator: detail.aggregatorId || 'unknown',
        bridge_chain: detail.chainId || 'unknown',
        bridge_to_chain: detail.toChainId || 'unknown',
        bridge_id: detail.bridgeId || 'unknown',
        bridge_method: detail.method || 'unknown',
        bridge_selector: detail.selector || 'unknown',
      },
      extra: { bridge_sdk: payload },
      fingerprint: [
        'bridge-sdk',
        payload.error_code,
        detail.aggregatorId || 'unknown',
        detail.chainId || 'unknown',
        detail.bridgeId || 'unknown',
        detail.method || detail.selector || 'unknown',
      ],
    });
    pendingKeys.forEach(key => reportedCalldataFailures.add(key));
  } catch {
    // Reporting must not change quote selection or transaction submission.
  }
};

export const getBridgeQuoteList = async (
  aggregatorId: string,
  params: BridgeQuoteListParams,
  api: BridgeApi,
) => {
  const options = { ...params, lite: true, onError: reportBridgeSdkError };
  try {
    return await bridgeSdk.getQuoteList(aggregatorId, options, api);
  } catch (error) {
    reportBridgeSdkError(error);
    throw error;
  }
};

export const buildBridgeTx = async (
  aggregatorId: string,
  params: BridgeBuildTxParams & { toTokenRawAmount: string },
  api: BridgeApi,
) => {
  const options = { ...params, lite: true, onError: reportBridgeSdkError };
  try {
    return await bridgeSdk.buildTx(aggregatorId, options, api);
  } catch (error) {
    reportBridgeSdkError(error);
    throw error;
  }
};
