import { OpenApiService } from '@rabby-wallet/rabby-api';
import type { RabbyApiPlugin } from '@rabby-wallet/rabby-api/dist/plugins/intf';
import { gS } from '@rabby-wallet/rabby-sign-bvm/es/sign-rabby';
import type {
  AssetSyncWorkerBootstrap,
  TokenAssetApi,
} from '@rabby-wallet/asset-sync-worker-core';

const SIGN_HEADERS = [
  'x-api-ts',
  'x-api-nonce',
  'x-api-ver',
  'x-api-sign',
] as const;
const API_KEY_HEADERS = ['X-API-Key', 'X-API-Time'] as const;

export function createWorkerTokenAssetApi(
  bootstrap: AssetSyncWorkerBootstrap,
): TokenAssetApi {
  const store = {
    host: bootstrap.host,
    apiKey: bootstrap.apiKey,
    apiTime: bootstrap.apiTime,
  };
  const plugin: RabbyApiPlugin = {
    async onSignRequest(ctx) {
      const { method, url, params } = ctx.parsed;
      const signature = gS(params, method, url);
      const headers = (ctx.axiosRequestConfig.headers ||= {});

      if (store.apiKey && store.apiTime) {
        headers[API_KEY_HEADERS[0]] = store.apiKey;
        headers[API_KEY_HEADERS[1]] = store.apiTime;
      } else {
        delete headers[API_KEY_HEADERS[0]];
        delete headers[API_KEY_HEADERS[1]];
      }
      headers[SIGN_HEADERS[0]] = encodeURIComponent(signature.ts);
      headers[SIGN_HEADERS[1]] = encodeURIComponent(signature.nonce);
      headers[SIGN_HEADERS[2]] = encodeURIComponent(signature.version);
      headers[SIGN_HEADERS[3]] = encodeURIComponent(signature.signature);
    },
  };
  const openapi = new OpenApiService({
    store,
    plugin,
    clientName: 'rabbymobile',
    clientVersion: bootstrap.clientVersion,
  });
  openapi.initSync();

  return {
    usedChainList: address => openapi.usedChainList(address),
    listToken: (address, chainId, includeAll) =>
      openapi.listToken(address, chainId, includeAll),
  };
}
