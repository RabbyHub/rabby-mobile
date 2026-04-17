import abiCoderInst, { AbiCoder } from 'web3-eth-abi';
import {
  getApprovalProbeErrorMessage,
  recordApprovalProbe,
  shouldLogApprovalProbeMethod,
} from '@/debug/approvalProbe';

import { getProviderExecutor } from '../controllers/providerExecutor';
import { ProviderRequest } from '../controllers/type';
import { Account } from '../services/preference';

export function sendRequest<T = any>(
  {
    data,
    session,
    account,
  }: {
    data: ProviderRequest['data'];
    session: ProviderRequest['session'];
    account: Account | null;
  },
  isBuild = false,
) {
  const shouldLogMethod = shouldLogApprovalProbeMethod(data.method);

  if (shouldLogMethod) {
    recordApprovalProbe('SEND_REQUEST_DISPATCH', {
      kind: 'internal',
      method: data.method,
      origin: session.origin,
      hasAccount: !!account,
      isBuild,
    });
  }

  if (isBuild) {
    return Promise.resolve<T>(data as T);
  }
  return getProviderExecutor()
    .then(provider =>
      provider<T>({
        data,
        session,
        account,
      }),
    )
    .then(result => {
      if (shouldLogMethod) {
        recordApprovalProbe('SEND_REQUEST_RESOLVED', {
          kind: 'internal',
          method: data.method,
          origin: session.origin,
        });
      }

      return result;
    })
    .catch(error => {
      if (shouldLogMethod) {
        recordApprovalProbe(
          'SEND_REQUEST_ERROR',
          {
            kind: 'internal',
            method: data.method,
            origin: session.origin,
            error: getApprovalProbeErrorMessage(error),
          },
          { level: 'warn' },
        );
      }

      throw error;
    });
}

export function dappSendRequest<T = any>(
  {
    data,
    session,
  }: {
    data: ProviderRequest['data'];
    session: ProviderRequest['session'];
  },
  isBuild = false,
) {
  const shouldLogMethod = shouldLogApprovalProbeMethod(data.method);

  if (shouldLogMethod) {
    recordApprovalProbe('SEND_REQUEST_DISPATCH', {
      kind: 'dapp',
      method: data.method,
      origin: session.origin,
      hasAccount: false,
      isBuild,
    });
  }

  if (isBuild) {
    return Promise.resolve<T>(data as T);
  }
  return getProviderExecutor()
    .then(provider =>
      provider<T>({
        data,
        session,
      }),
    )
    .then(result => {
      if (shouldLogMethod) {
        recordApprovalProbe('SEND_REQUEST_RESOLVED', {
          kind: 'dapp',
          method: data.method,
          origin: session.origin,
        });
      }

      return result;
    })
    .catch(error => {
      if (shouldLogMethod) {
        recordApprovalProbe(
          'SEND_REQUEST_ERROR',
          {
            kind: 'dapp',
            method: data.method,
            origin: session.origin,
            error: getApprovalProbeErrorMessage(error),
          },
          { level: 'warn' },
        );
      }

      throw error;
    });
}

export const abiCoder = abiCoderInst as unknown as AbiCoder;
