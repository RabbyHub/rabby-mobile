import { beforeConfigIntegrityMetadataWrite } from '@/core/configIntegrity/probe';
import { appStorage } from '../storage/mmkv';
import { appMMKV } from '../storage/mmkvInstances';
import { createConfigIntegrity } from './coordinator';
import { CONFIG_INTEGRITY_KEY, registry } from './schema';

export const configIntegrity = createConfigIntegrity(
  registry,
  {
    has: key => appMMKV.contains(key),
    read: key => appMMKV.getString(key),
    writeMetadata: metadata => {
      beforeConfigIntegrityMetadataWrite();
      appStorage.setItem(CONFIG_INTEGRITY_KEY, metadata);
    },
  },
  appStorage,
);
