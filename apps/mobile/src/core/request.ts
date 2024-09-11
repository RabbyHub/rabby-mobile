import { OpenApiService } from '@rabby-wallet/rabby-api';
import { RabbyApiPlugin } from '@rabby-wallet/rabby-api/dist/plugins/intf';

import * as Sign from '@debank/rabby-rn-security/es/sign-rn-rabby';
import { APP_VERSIONS } from '@/constant';

const SIGN_HDS = [
  'x-api-ts',
  'x-api-nonce',
  'x-api-ver',
  'x-api-sign',
] as const;

export const SignApiPlugin: RabbyApiPlugin = {
  async onSignRequest(ctx) {
    const { parsed, axiosRequestConfig: config } = ctx;
    const { method, url, params } = parsed;
    const res = Sign.cattleGenerateSignature(params, method as any, url);

    config.headers = config.headers || {};
    config.headers[SIGN_HDS[0]] = encodeURIComponent(res.ts);
    config.headers[SIGN_HDS[1]] = encodeURIComponent(res.nonce);
    config.headers[SIGN_HDS[2]] = encodeURIComponent(res.version);
    config.headers[SIGN_HDS[3]] = encodeURIComponent(res.signature);
  },
};

export const openapi = new OpenApiService({
  store: {
    host: __DEV__ ? 'https://alpha.rabby.io' : 'https://app-api.rabby.io',
  },
  plugin: SignApiPlugin,
  clientName: 'rabbymobile',
  clientVersion: APP_VERSIONS.fromJs,
});
openapi.initSync();

export const testOpenapi = new OpenApiService({
  store: {
    host: __DEV__
      ? 'https://app-api.testnet.rabby.io'
      : 'https://app-api.testnet.rabby.io',
  },
  plugin: SignApiPlugin,
  clientName: 'rabbymobile',
  clientVersion: APP_VERSIONS.fromJs,
});
testOpenapi.initSync();

export async function getOpenApiService(
  type: 'mainnet' | 'testnet' = 'mainnet',
) {
  return type === 'testnet' ? testOpenapi : openapi;
}
