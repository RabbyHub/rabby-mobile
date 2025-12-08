import { OPSQLiteEvents } from '@/core/databases/op-sqlite/events';
import type { ReactotronCore } from 'reactotron-core-client';
import { runDevIIFEFunc } from '../store';
import { reactotronEvents } from './_utils';
import { prepareAppDataSource } from '@/databases/imports';
export interface OpSQLitePluginConfig {}

interface Listener {
  remove: () => void;
}

type DisplayConfig = Parameters<ReactotronCore['display']>[0];

const log2Reactotron = (
  reactotron: ReactotronCore,
  { name, ...rest }: Partial<DisplayConfig>,
) => {
  reactotron.display({
    name: name || 'OPSQLite',
    important: true,
    ...rest,
  });
};

/**
 * Reactotron plugin to log OPSQLite changes
 */
export default function opSQLitePlugin<
  Client extends ReactotronCore = ReactotronCore,
>(config?: OpSQLitePluginConfig) {
  /** This gives us the ability to ignore specific writes for less noise */
  // const ignore = config.ignore ?? [];

  let listener: Listener | undefined;

  return (reactotron: Client) => {
    return {
      onConnect() {
        listener = OPSQLiteEvents.subscribe('UPDATE_HOOK', payload => {
          const previewMsg = `[opSQLitePlugin] Table: ${payload.table}, Operation: ${payload.operation}, RowID: ${payload.rowId}`;
          log2Reactotron(reactotron, {
            name: 'OPSQLite Update',
            preview: previewMsg,
            value: {
              operation: payload.operation,
              rowid: payload.rowId,
              table: payload.table,
            },
          });
        });
      },
      onDisconnect() {
        listener?.remove();
      },
    };
  };
}
