import { MMKV, MMKVConfiguration } from 'react-native-mmkv';
import { MMKV_FILE_NAMES } from '../utils/appFS';

function makePrimitiveStorage<V extends string | number | Buffer | boolean>({
  type = 'string',
  ...options
}: MMKVConfiguration & {
  type?: 'string' | 'number' | 'boolean' | 'buffer';
}) {
  const mmkv = new MMKV(options);

  function getStringValue(key: string): V | null {
    return mmkv.getString(key) as V | null;
  }

  function getBooleanValue(key: string): V | null {
    const value = mmkv.getBoolean(key);
    return value === undefined ? null : (value as V);
  }

  function getNumberValue(key: string): V | null {
    const value = mmkv.getNumber(key);
    return value === undefined ? null : (value as V);
  }

  function getBufferValue(key: string): V | null {
    const value = mmkv.getBuffer(key);
    return value === undefined ? null : (value as V);
  }

  function setValue(key: string, value: V): void {
    mmkv.set(key, value);
  }

  function removeItem(key: string): void {
    mmkv.delete(key);
  }

  function clearAll(): void {
    mmkv.clearAll();
  }

  const kvStorage = {
    getValue:
      type === 'string'
        ? getStringValue
        : type === 'boolean'
        ? getBooleanValue
        : type === 'number'
        ? getNumberValue
        : getBufferValue,
    setValue: setValue,
    removeItem: removeItem,
    clearAll: clearAll,
    flushToDisk: () => {
      mmkv.trim();
    },
  };

  return {
    kvStorage,
  };
}

// const { kvStorage: mediaKV } = makePrimitiveStorage({
//   type: 'buffer',
//   id: MMKV_FILE_NAMES.P_MEDIA,
// });
