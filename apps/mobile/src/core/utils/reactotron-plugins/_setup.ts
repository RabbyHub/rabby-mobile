import Reactotron, { ReactotronReactNative } from 'reactotron-react-native';
import { ArgType } from 'reactotron-core-client';
import { reactotronEvents } from './_utils';
import { stringUtils } from '@rabby-wallet/base-utils';

export function setupCustomCommands(client: ReactotronReactNative) {
  Reactotron.onCustomCommand({
    command: 'executeSql',
    title: 'Execute SQL Command',
    description: `Executes a raw SQL command on the database, e.g. "SELECT COUNT(_db_id) FROM rabby_cache_tokenitem;"`,
    args: [
      {
        name: 'sql',
        type: ArgType.String,
      },
    ],
    handler: payload => {
      reactotronEvents.emit('CM_EXECUTE_SQL', {
        reqid: stringUtils.randString(),
        sql: payload?.sql as string,
      });

      return { success: true, receivedPayload: payload };
    },
  });

  Reactotron.onCustomCommand({
    command: 'logMMKVStore',
    title: 'Log MMKV Store',
    description: 'Logs the current state of the MMKV store on DevTools',
    args: [
      {
        name: 'mmkvName',
        type: ArgType.String,
      },
    ],
    handler: payload => {
      reactotronEvents.emit('CM_LOG_MMKV_STORE', {
        reqid: stringUtils.randString(),
        mmkvName: payload?.mmkvName as any,
      });

      return { success: true };
    },
  });
}
