import { OpenApiService } from '@rabby-wallet/rabby-api';
import { OpenApiStore, openApiStore } from '../services/openapiStore';
import { SignApiPlugin } from '../request';
import {
  APP_VERSIONS,
  INITIAL_OPENAPI_URL,
  isNonPublicProductionEnv,
} from '@/constant';
import { APP_STORE_NAMES } from '../storage/storeConstant';
import { ensureDeviceUUID, makeDeviceUUID } from '../apis/device';
import {
  TxAllHistoryResult,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';

export type DeviceActiveStatusResponse = {
  success: boolean;
  device_id: string;
  is_active: boolean;
};

export type HeartbeatResponse = {
  success: boolean;
  device_id: string;
  ttl: number;
};

export type BindDeviceResponse = {
  success: boolean;
  device_id: string;
  total: number;
  added: number;
  removed: number;
};

class NotificationsOpenApiService extends OpenApiService {
  #getDeviceUUID() {
    return makeDeviceUUID().deviceUUID;
  }
  async setDeviceActiveStatus(params: {
    // deviceId: string;
    isActive: boolean;
  }): Promise<DeviceActiveStatusResponse> {
    const response = await this.request.post('/v1/notification/device/active', {
      device_id: this.#getDeviceUUID(),
      is_active: params.isActive,
    });
    return response.data;
  }

  async heartbeat(/* params: { deviceId: string } */): Promise<HeartbeatResponse> {
    const response = await this.request.post(
      '/v1/notification/device/heartbeat',
      {
        device_id: this.#getDeviceUUID(),
      },
    );
    return response.data;
  }

  async bindDevice(params: {
    // deviceId: string;
    platform: 'ios' | 'android';
    pushToken: string;
    userAddrs: string[];
  }): Promise<BindDeviceResponse> {
    const response = await this.request.post('/v1/notification/bind', {
      device_id: this.#getDeviceUUID(),
      platform: params.platform,
      push_token: params.pushToken,
      user_addrs: params.userAddrs,
    });
    return response.data;
  }

  async getUserTxDetail(params: {
    chainId: string;
    txId: string;
  }): Promise<TxHistoryResult | null> {
    const response = await this.request.get('/v1/user/tx', {
      params: {
        chain_id: params.chainId,
        tx_id: params.txId,
      },
    });

    return response.data;
  }
}

const apiStore = new OpenApiStore({
  name: APP_STORE_NAMES.notificationOpenapi,
});
apiStore.store.api.host = isNonPublicProductionEnv
  ? INITIAL_OPENAPI_URL.replace('app-api.', 'alpha.')
  : INITIAL_OPENAPI_URL;

export const notificationOpenapi = new NotificationsOpenApiService({
  store: apiStore,
  plugin: SignApiPlugin,
  clientName: 'rabbymobile',
  clientVersion: APP_VERSIONS.fromJs,
});

notificationOpenapi.initSync();
