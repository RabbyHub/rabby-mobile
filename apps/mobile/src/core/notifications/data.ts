import { stringUtils } from '@rabby-wallet/base-utils';
import { makeJsEEClass } from '@/core/services/_utils';

type RemoteBizCommonBase = {
  bizVersion: 'v20260122';
  // "bizJson": "{\n  \"chainServerId\": \"polygon\",\n  \"txHash\": \"0xd146ff8dc12c5ef00e702e613ffc61dfc2836d37cec2aa3a4db7bb8d3db12409\"\n}",
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
    ownerAddress?: string;
    chainServerId?: string;
    txHash?: string;
  };
};

export type NotificationEventBusListeners = {
  onParsedReceivedData: (ctx: {
    parsedData: ParsedBizData;
    iosFromLaunch?: boolean;
  }) => void;
};
const { EventEmitter: NotificationEE } =
  makeJsEEClass<NotificationEventBusListeners>();
export const notificationEvents = new NotificationEE();

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
      ownerAddress: string;
      chainServerId: string;
      txHash: string;
    }>(input?.bizJson || '{}');
    if (bizJson?.chainServerId && bizJson?.txHash) {
    }
    result.bizType = 'transaction_created';
    result.txInfo = result.txInfo || {};
    if (bizJson?.ownerAddress) {
      result.txInfo.ownerAddress = bizJson.ownerAddress;
    }
    if (bizJson?.chainServerId) {
      result.txInfo.chainServerId = bizJson.chainServerId;
    }
    if (bizJson?.txHash) {
      result.txInfo.txHash = bizJson.txHash;
    }
  }

  result._parseSuccess = true;

  return result;
}
