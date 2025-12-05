import { stringUtils } from '@rabby-wallet/base-utils';
import { type MMKV } from 'react-native-mmkv';
import type { ReactotronCore } from 'reactotron-core-client';
import { log2Reactotron } from './_utils';

export interface MmkvPluginConfig {
  /**
   * MMKV storage instance
   * @example
   * import { MMKV } from "react-native-mmkv"
   * const storage = new MMKV()
   */
  storage: MMKV;
  /** Storage keys you want to ignore */
  ignore?: Array<string>;
  formatValue?: (value: any) => any;
}

interface Listener {
  remove: () => void;
}

// slice query string, [0...500] + [-500...end]
function formatValueString(query: string, len = 500): string {
  if (query.length <= len) {
    return query;
  }

  const half = Math.floor(len / 2);

  return `${query.slice(0, half)}...${query.slice(-half)}`;
}

/**
 * Reactotron plugin to log MMKV storage changes
 *
 * @example
 * import { MMKV } from 'react-native-mmkv'
 * import type { ReactotronReactNative } from 'reactotron-react-native'
 * // create your storage instance
 * const storage = new MMKV()
 *
 * // pass your instance to the plugin
 * Reactotron.use(mmkvPlugin<ReactotronReactNative>({ storage }))
 */
export default function mmkvPlugin<
  Client extends ReactotronCore = ReactotronCore,
>(config: MmkvPluginConfig) {
  /** This gives us the ability to ignore specific writes for less noise */
  const ignore = config.ignore ?? [];

  let listener: Listener | undefined;

  return (reactotron: Client) => {
    return {
      onConnect() {
        listener = config.storage.addOnValueChangedListener(key => {
          const keyIsIgnored = ignore.includes(key);
          if (keyIsIgnored) return;
          // const value = config.storage.getString(key) ?? "undefined"
          const rawValue = config.storage.getString(key);
          const value = stringUtils.safeParseJSON(rawValue || '', {
            defaultValue: rawValue,
          });

          log2Reactotron(reactotron, {
            name: `MMKV: ${key}`,
            value: { key, value },
            preview: `Set "${key}" to ${formatValueString(rawValue || '', 30)}`,
          });
        });
      },
      onDisconnect() {
        listener?.remove();
      },
    };
  };
}
