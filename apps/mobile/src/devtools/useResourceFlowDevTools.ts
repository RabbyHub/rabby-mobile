import {
  type ResourceFlowDevToolsEventMap,
  RESOURCE_FLOW_DEVTOOLS_PLUGIN_ID,
} from '@rabby-wallet/rozenite-resource-flow-plugin';
import {
  RESOURCE_FLOW_RESOURCE_REMOVED,
  getResourceFlowResourceSnapshots,
  getResourceFlowTraceEntries,
  RESOURCE_FLOW_RESOURCE_UPSERTED,
  RESOURCE_FLOW_TRACE_ADDED,
  RESOURCE_FLOW_TRACE_CLEARED,
  resourceFlowDebugEvents,
} from '@/store/_resourceFlowDebug';
import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { useEffect } from 'react';

const getResourceFlowSnapshotPayload =
  (): ResourceFlowDevToolsEventMap['resource-flow-snapshot'] => ({
    entries: getResourceFlowTraceEntries(),
    resources: Object.values(getResourceFlowResourceSnapshots()),
  });

export function useResourceFlowDevTools() {
  const client = useRozeniteDevToolsClient<ResourceFlowDevToolsEventMap>({
    pluginId: RESOURCE_FLOW_DEVTOOLS_PLUGIN_ID,
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const sendSnapshot = () => {
      client.send('resource-flow-snapshot', getResourceFlowSnapshotPayload());
    };

    sendSnapshot();

    const traceSub = resourceFlowDebugEvents.subscribe(
      RESOURCE_FLOW_TRACE_ADDED,
      entry => {
        client.send('resource-flow-trace-added', {
          entry,
        });
      },
    );
    const clearSub = resourceFlowDebugEvents.subscribe(
      RESOURCE_FLOW_TRACE_CLEARED,
      () => {
        client.send('resource-flow-traces-cleared', {});
      },
    );
    const resourceSub = resourceFlowDebugEvents.subscribe(
      RESOURCE_FLOW_RESOURCE_UPSERTED,
      resource => {
        client.send('resource-flow-resource-upserted', {
          resource,
        });
      },
    );
    const removeSub = resourceFlowDebugEvents.subscribe(
      RESOURCE_FLOW_RESOURCE_REMOVED,
      resourceId => {
        client.send('resource-flow-resource-removed', {
          resourceId,
        });
      },
    );
    const requestSub = client.onMessage(
      'resource-flow-request-snapshot',
      () => {
        sendSnapshot();
      },
    );

    return () => {
      traceSub.remove();
      clearSub.remove();
      resourceSub.remove();
      removeSub.remove();
      requestSub.remove();
    };
  }, [client]);
}

export default useResourceFlowDevTools;
