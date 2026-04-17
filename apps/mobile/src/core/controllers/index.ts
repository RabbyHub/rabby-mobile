import { ProviderRequest } from './type';

import { ethErrors } from 'eth-rpc-errors';
import type KeyringService from '@rabby-wallet/service-keyring';
import {
  getApprovalProbeErrorMessage,
  recordApprovalProbe,
  shouldLogApprovalProbeMethod,
} from '@/debug/approvalProbe';
import type { DappService } from '../services/dappService';
import type { PreferenceService } from '../services/preference';

import rpcFlow from './rpcFlow';
import internalMethod from './internalMethod';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import type { Account } from '../services/preference';
import { getServiceReady, SERVICE_READY_KEYS } from '../services/serviceReady';
import { registerProviderExecutor } from './providerExecutor';

const IGNORE_CHECK = ['wallet_importAddress'];

type ProviderDappServiceLike = Pick<DappService, 'getDapp'>;
type ProviderKeyringServiceLike = Pick<KeyringService, 'hasVault'>;
type ProviderPreferenceServiceLike = Pick<
  PreferenceService,
  'getFallbackAccount'
>;

export default async function provider<T = void>(
  req: ProviderRequest,
): Promise<T> {
  const [dappService, keyringService, preferenceService] = await Promise.all([
    getServiceReady<ProviderDappServiceLike>(SERVICE_READY_KEYS.dappService),
    getServiceReady<ProviderKeyringServiceLike>(
      SERVICE_READY_KEYS.keyringService,
    ),
    getServiceReady<ProviderPreferenceServiceLike>(
      SERVICE_READY_KEYS.preferenceService,
    ),
  ]);
  const {
    data: { method },
  } = req;

  const origin = req.session?.origin || req.origin;
  let account: Account | undefined = undefined;
  const shouldLogMethod = shouldLogApprovalProbeMethod(method);

  if (origin) {
    if (origin === INTERNAL_REQUEST_ORIGIN) {
      account =
        req.account || preferenceService.getFallbackAccount() || undefined;
    } else {
      const site = dappService.getDapp(origin);
      if (site?.isConnected) {
        account =
          site.currentAccount ||
          preferenceService.getFallbackAccount() ||
          undefined;
      }
    }
  }

  req.account = account;

  if (shouldLogMethod) {
    recordApprovalProbe('PROVIDER_EXECUTOR_CALL', {
      method,
      origin: origin || null,
      isInternalOrigin: origin === INTERNAL_REQUEST_ORIGIN,
      hasResolvedAccount: !!account,
    });
  }

  if (internalMethod[method]) {
    const result = await internalMethod[method](req);

    if (shouldLogMethod) {
      recordApprovalProbe('PROVIDER_EXECUTOR_INTERNAL_METHOD_RESOLVED', {
        method,
        origin: origin || null,
      });
    }

    return result;
  }

  if (!IGNORE_CHECK.includes(method)) {
    const hasVault = keyringService.hasVault();
    if (!hasVault) {
      if (shouldLogMethod) {
        recordApprovalProbe(
          'PROVIDER_EXECUTOR_NO_VAULT',
          {
            method,
            origin: origin || null,
          },
          { level: 'warn' },
        );
      }
      throw ethErrors.provider.userRejectedRequest({
        message: 'wallet must has at least one account',
      });
    }
  }

  try {
    const result = await rpcFlow(req);

    if (shouldLogMethod) {
      recordApprovalProbe('PROVIDER_EXECUTOR_RESOLVED', {
        method,
        origin: origin || null,
      });
    }

    return result as T;
  } catch (error) {
    if (shouldLogMethod) {
      recordApprovalProbe(
        'PROVIDER_EXECUTOR_ERROR',
        {
          method,
          origin: origin || null,
          error: getApprovalProbeErrorMessage(error),
        },
        { level: 'warn' },
      );
    }

    throw error;
  }
}

registerProviderExecutor(provider, {
  source: 'controllers-index',
});
