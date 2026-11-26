import { instrumentConfigIntegrityRuntime } from '@/core/configIntegrity/probe';
import {
  Buffer,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'react-native-quick-crypto';
import { createConfigIntegrityKeychain } from '../apis/keychain';
import { reportConfigIntegrity } from './diagnostics';
import { configIntegrity } from './storage';

export function startConfigIntegrity() {
  const scan = configIntegrity.getScan();
  if (scan) {
    return scan;
  }
  return configIntegrity.start(
    instrumentConfigIntegrityRuntime({
      keychain: createConfigIntegrityKeychain(),
      generateKey: () => randomBytes(32).toString('hex'),
      sign: (key, input) =>
        createHmac('sha256', Buffer.from(key, 'hex'))
          .update(input)
          .digest('hex'),
      matches: (first, second) =>
        timingSafeEqual(Buffer.from(first, 'hex'), Buffer.from(second, 'hex')),
      report: reportConfigIntegrity,
    }),
  );
}
