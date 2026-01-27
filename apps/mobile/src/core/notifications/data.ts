import { stringUtils } from '@rabby-wallet/base-utils';

type RemoteBizCommonBase = {
  bizVersion: 'v20260122';
  // "bizJson": "{\n  \"chainId\": \"polygon\",\n  \"txHash\": \"0xd146ff8dc12c5ef00e702e613ffc61dfc2836d37cec2aa3a4db7bb8d3db12409\"\n}",
  bizJson: string;
  // "_jsonTime": "{\"timestamp\":1769514273932,\"seconds\":1769514273}",
  _jsonTime: string;
  imageUrl?: string;
  title?: string;
  body?: string;
  // "_jsonPushAbout": "{\"iosPushType\":\"alert\",\"iosPushTarget\":\"all\",\"iosTopic\":\"com.debank.rabby-mobile-debug\"}",
  _jsonPushAbout: string;

  /** ios only properties */
  notificationId?: string;
  remote?: boolean;
};
export type NotificationBizData = RemoteBizCommonBase & {
  bizType?: 'transaction_created';
};

export type ParsedBizData = {
  _parseSuccess: boolean;
  bizVersion: RemoteBizCommonBase['bizVersion'];
  sendTime?: number;
} & {
  bizType?: 'transaction_created';
  txInfo?: {
    chainId: string;
    txHash: string;
  };
};

export function parseRemoteData(input?: Partial<NotificationBizData> | null) {
  const result: ParsedBizData = {
    _parseSuccess: false,
    bizVersion: 'v20260122',
  };
  if (!input) return result;
  if (input?.bizVersion !== 'v20260122') {
    console.warn('Unsupported bizVersion:', input.bizVersion);
  }

  const _jsonTime = stringUtils.safeParseJSON<{ timestamp: number }>(
    input?._jsonTime || '{}',
  );
  if (_jsonTime?.timestamp) {
    result.sendTime = _jsonTime.timestamp;
  }

  if (input.bizType === 'transaction_created') {
    const bizJson = stringUtils.safeParseJSON<{
      chainId: string;
      txHash: string;
    }>(input?.bizJson || '{}');
    if (bizJson?.chainId && bizJson?.txHash) {
      result.bizType = 'transaction_created';
      result.txInfo = {
        chainId: bizJson.chainId,
        txHash: bizJson.txHash,
      };
    }
  }

  result._parseSuccess = true;

  return result;
}
