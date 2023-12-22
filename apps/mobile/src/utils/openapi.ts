import { openapi, testOpenapi } from '@/core/request';
import { OpenApiService } from '@rabby-wallet/rabby-api';
import { IExtractFromPromise } from './type';

type IOpenAPIClient = OpenApiService;
type AllKeysOnOpenAPI = keyof IOpenAPIClient;
type AllMethodNamesOnOpenAPI = {
  [P in AllKeysOnOpenAPI]: Exclude<IOpenAPIClient[P], undefined> extends (
    ...args: any[]
  ) => any
    ? P
    : never;
}[AllKeysOnOpenAPI];

type ResultType<T> = {
  mainnet: T;
  testnet: T | null;
};
type IHandleResults<T, R> = (ctx: ResultType<T>) => R extends T ? T : R;
const defaultProcessResults = <T>(ctx: ResultType<T>) => {
  return ctx.mainnet;
};

export async function requestOpenApiMultipleNets<
  T extends
    | IExtractFromPromise<
        ReturnType<Exclude<IOpenAPIClient[AllMethodNamesOnOpenAPI], undefined>>
      >
    | any,
  R = T,
>(
  request: (ctx: {
    /**
     * @description openapi instance for every request task
     *
     * one request to mainnet would be always sent, if `options.needTestnetResult`
     * is true, then another request to testnet would be also sent.
     *
     */
    openapi: IOpenAPIClient;
    isTestnetTask?: boolean;
  }) => Promise<T> | T,
  options: {
    fallbackValues: ResultType<T>;
    needTestnetResult?: boolean;
    processResults?: IHandleResults<T, R>;
  },
): Promise<R extends T ? T : R> {
  const {
    needTestnetResult = false,
    processResults = defaultProcessResults as IHandleResults<T, R>,
    fallbackValues,
  } = options || {};

  const mainnetOpenapi = openapi;
  const testnetOpenapi = testOpenapi;

  // if (!needTestnetResult) {
  //   return request({ wallet, openapi: mainnetOpenapi });
  // }

  const mainnetP = request({ openapi: mainnetOpenapi });
  const testnetP = !needTestnetResult
    ? null
    : request({
        openapi: testnetOpenapi,
        isTestnetTask: true,
      });

  return Promise.allSettled([mainnetP, testnetP]).then(([mainnet, testnet]) => {
    const mainResult =
      mainnet.status === 'fulfilled' ? mainnet.value : fallbackValues.mainnet;
    const testResult =
      testnet.status === 'fulfilled' ? testnet.value : fallbackValues.testnet;

    return processResults({
      mainnet: mainResult,
      testnet: testResult,
    });
  });
}

export async function requestOpenApiWithChainId<
  T extends IExtractFromPromise<
    ReturnType<Exclude<IOpenAPIClient[AllMethodNamesOnOpenAPI], undefined>>
  >,
>(
  request: (ctx: {
    /**
     * @description final openapi instance, determined by options.isTestnet
     */
    openapi: IOpenAPIClient;
  }) => Promise<T>,
  options: {
    isTestnet?: boolean;
  },
) {
  const { isTestnet = false } = options || {};

  const mainnetOpenapi = openapi;
  const testnetOpenapi = testOpenapi;

  if (!isTestnet) {
    return request({ openapi: mainnetOpenapi });
  }

  return request({ openapi: testnetOpenapi });
}
