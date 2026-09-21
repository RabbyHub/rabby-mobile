import { IS_ROZENITE_ENABLED } from '@/constant/env';
import { APP_MMKV_KEYS, MMKV_FILE_NAMES } from '@/core/storage/mmkvConstants';
import { ALL_KNOWN_MMKV_INSTANCES } from '@/core/storage/mmkvInstances';
import { navigationRef } from '@/utils/navigation';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';
import {
  createMMKVStorageAdapter,
  useRozeniteStoragePlugin,
} from '@rozenite/storage-plugin';
import { useNetworkActivityDevTools } from '@rozenite/network-activity-plugin';
import React from 'react';
import { useResourceFlowDevTools } from './useResourceFlowDevTools';

const rozeniteStorageAdapters = [
  createMMKVStorageAdapter({
    adapterId: 'rabby-mmkv',
    adapterName: 'Rabby MMKV',
    storages: ALL_KNOWN_MMKV_INSTANCES,
    blacklist: {
      [MMKV_FILE_NAMES.DEFAULT]: new RegExp(
        [
          `^${APP_MMKV_KEYS.LEGACY_KEYRING_STATE}$`,
          'password',
          'secret',
          'mnemonic',
          'seed',
          'private',
          'token',
          'session',
        ].join('|'),
        'i',
      ),
      [MMKV_FILE_NAMES.KEYRING]: new RegExp(
        [`^${APP_MMKV_KEYS.LEGACY_KEYRING_STATE}$`].join('|'),
        'i',
      ),
    },
  }),
];

function RozeniteDevToolsEnabled() {
  useReactNavigationDevTools({
    ref: navigationRef as React.RefObject<any>,
  });
  useNetworkActivityDevTools({
    inspectors: {
      http: true,
      websocket: false,
      sse: false,
    },
  });
  useRozeniteStoragePlugin({ storages: rozeniteStorageAdapters });
  useResourceFlowDevTools();

  return null;
}

export default function RozeniteDevTools() {
  if (!IS_ROZENITE_ENABLED) {
    return null;
  }

  return <RozeniteDevToolsEnabled />;
}
