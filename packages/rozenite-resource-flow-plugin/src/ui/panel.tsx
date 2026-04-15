import 'antd/dist/reset.css';

import { useRozeniteDevToolsClient } from '@rozenite/plugin-bridge';
import { Button, ConfigProvider, Empty, Input, Select, Tabs } from 'antd';
import type { TabsProps } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';

import {
  RESOURCE_FLOW_DEVTOOLS_PLUGIN_ID,
  type ResourceFlowDevToolsEventMap,
  type ResourceFlowTraceEntry,
} from '../shared/types';
import {
  FamilySummaryContent,
  ResourceDetailContent,
  ResourceSidebarContent,
} from './panel-sections';
import { usePanelTheme } from './panel-theme';
import {
  buildAddressBalanceFamilyStats,
  buildAddressBalanceResourceBreakdown,
  buildAppChainFamilyStats,
  buildFamilySummary,
  getResourceUpdatedAt,
} from './panel-utils';
import './globals.css';

type MainTabKey = 'family' | 'resource';
type FamilyOption = {
  value: string;
  label: string;
  count: number;
};

export default function ResourceFlowPanel() {
  const [entries, setEntries] = useState<ResourceFlowTraceEntry[]>([]);
  const [resources, setResources] = useState<
    ResourceFlowDevToolsEventMap['resource-flow-snapshot']['resources']
  >([]);
  const [filterText, setFilterText] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedMainTab, setSelectedMainTab] = useState<MainTabKey>('family');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  );

  const { antThemeConfig, panelThemeStyle, themeMode } = usePanelTheme();

  const client = useRozeniteDevToolsClient<ResourceFlowDevToolsEventMap>({
    pluginId: RESOURCE_FLOW_DEVTOOLS_PLUGIN_ID,
  });

  useEffect(() => {
    if (!client) {
      return;
    }

    const requestSnapshot = () => {
      client.send('resource-flow-request-snapshot', {});
    };

    requestSnapshot();

    const snapshotSub = client.onMessage('resource-flow-snapshot', payload => {
      setEntries(payload.entries);
      setResources(payload.resources);
    });
    const traceSub = client.onMessage('resource-flow-trace-added', payload => {
      setEntries(previous => [...previous, payload.entry].slice(-300));
    });
    const resourceSub = client.onMessage(
      'resource-flow-resource-upserted',
      payload => {
        setResources(previous => {
          const next = previous.filter(item => item.id !== payload.resource.id);
          next.push(payload.resource);
          return next;
        });
      },
    );
    const removeSub = client.onMessage(
      'resource-flow-resource-removed',
      payload => {
        setResources(previous => {
          return previous.filter(item => item.id !== payload.resourceId);
        });
      },
    );
    const clearSub = client.onMessage('resource-flow-traces-cleared', () => {
      setEntries([]);
      setResources([]);
      setSelectedFamily(null);
      setSelectedResourceId(null);
      setSelectedMainTab('family');
    });

    return () => {
      snapshotSub.remove();
      traceSub.remove();
      resourceSub.remove();
      removeSub.remove();
      clearSub.remove();
    };
  }, [client]);

  const familyOptions = useMemo<FamilyOption[]>(() => {
    const counts = new Map<string, number>();

    resources.forEach(resource => {
      counts.set(resource.family, (counts.get(resource.family) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })
      .map(([family, count]) => ({
        value: family,
        label: family,
        count,
      }));
  }, [resources]);

  useEffect(() => {
    if (!familyOptions.length) {
      setSelectedFamily(null);
      return;
    }

    if (
      selectedFamily &&
      familyOptions.some(item => item.value === selectedFamily)
    ) {
      return;
    }

    setSelectedFamily(familyOptions[0].value);
  }, [familyOptions, selectedFamily]);

  const familyResources = useMemo(() => {
    if (!selectedFamily) {
      return [];
    }

    return resources.filter(resource => resource.family === selectedFamily);
  }, [resources, selectedFamily]);

  const familyEntries = useMemo(() => {
    if (!selectedFamily) {
      return [];
    }

    return entries.filter(entry => entry.family === selectedFamily);
  }, [entries, selectedFamily]);

  const filteredResources = useMemo(() => {
    const keyword = filterText.trim().toLowerCase();
    const sorted = [...familyResources].sort(
      (left, right) => getResourceUpdatedAt(right) - getResourceUpdatedAt(left),
    );

    if (!keyword) {
      return sorted;
    }

    return sorted.filter(resource => {
      return [
        resource.resourceKey,
        JSON.stringify(resource.meta.localTargets || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [familyResources, filterText]);

  useEffect(() => {
    if (!filteredResources.length) {
      setSelectedResourceId(null);
      return;
    }

    if (
      selectedResourceId &&
      filteredResources.some(item => item.id === selectedResourceId)
    ) {
      return;
    }

    setSelectedResourceId(filteredResources[0].id);
  }, [filteredResources, selectedResourceId]);

  const selectedResource = useMemo(
    () =>
      filteredResources.find(resource => resource.id === selectedResourceId) ||
      null,
    [filteredResources, selectedResourceId],
  );

  useEffect(() => {
    if (selectedMainTab === 'resource' && !selectedResource) {
      setSelectedMainTab('family');
    }
  }, [selectedMainTab, selectedResource]);

  const selectedTraces = useMemo(() => {
    if (!selectedResource) {
      return [];
    }

    return entries
      .filter(entry => {
        return (
          entry.family === selectedResource.family &&
          entry.resourceKey === selectedResource.resourceKey
        );
      })
      .sort((left, right) => right.at - left.at)
      .slice(0, 60);
  }, [entries, selectedResource]);

  const selectedFamilySummary = useMemo(() => {
    if (!selectedFamily) {
      return null;
    }

    return buildFamilySummary(selectedFamily, familyResources, familyEntries);
  }, [familyEntries, familyResources, selectedFamily]);

  const appChainFamilyStats = useMemo(() => {
    if (selectedFamily !== 'appchain') {
      return null;
    }

    return buildAppChainFamilyStats(familyResources);
  }, [familyResources, selectedFamily]);

  const addressBalanceFamilyStats = useMemo(() => {
    if (selectedFamily !== 'addressBalance') {
      return null;
    }

    return buildAddressBalanceFamilyStats(familyResources, resources);
  }, [familyResources, resources, selectedFamily]);

  const addressBalanceBreakdown = useMemo(() => {
    if (!selectedResource || selectedResource.family !== 'addressBalance') {
      return null;
    }

    return (
      buildAddressBalanceResourceBreakdown(selectedResource, resources) || null
    );
  }, [resources, selectedResource]);

  const mainTitle = useMemo(() => {
    if (!selectedFamily) {
      return 'No family selected';
    }

    if (selectedMainTab === 'resource' && selectedResource) {
      return `${selectedFamily} / ${selectedResource.resourceKey}`;
    }

    return `${selectedFamily} Family`;
  }, [selectedFamily, selectedMainTab, selectedResource]);

  const mainDescription = useMemo(() => {
    if (!selectedFamilySummary) {
      return 'Select a family from the left to inspect summary and individual resources.';
    }

    if (selectedMainTab === 'resource') {
      if (!selectedResource) {
        return 'Select a resource from the left list to inspect details.';
      }

      return `${selectedTraces.length} recent trace(s) for selected resource`;
    }

    return `${selectedFamilySummary.resourceCount} resource(s), ${selectedFamilySummary.traceCount} trace(s) in current family`;
  }, [
    selectedFamilySummary,
    selectedMainTab,
    selectedResource,
    selectedTraces.length,
  ]);

  const mainTabItems = useMemo<TabsProps['items']>(() => {
    return [
      {
        key: 'family',
        label: 'Family Summary',
        children: (
          <FamilySummaryContent
            selectedFamilySummary={selectedFamilySummary}
            appChainFamilyStats={appChainFamilyStats}
            addressBalanceFamilyStats={addressBalanceFamilyStats}
          />
        ),
      },
      {
        key: 'resource',
        label: 'Resource Detail',
        disabled: !selectedResource,
        children: (
          <ResourceDetailContent
            selectedResource={selectedResource}
            selectedTraces={selectedTraces}
            addressBalanceBreakdown={addressBalanceBreakdown}
          />
        ),
      },
    ];
  }, [
    addressBalanceBreakdown,
    addressBalanceFamilyStats,
    appChainFamilyStats,
    selectedFamilySummary,
    selectedResource,
    selectedTraces,
  ]);

  return (
    <ConfigProvider theme={antThemeConfig}>
      <div
        className="rf-panel grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)] bg-neutral-bg-0 text-neutral-title-1"
        data-theme={themeMode}
        style={panelThemeStyle}>
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-neutral-line bg-neutral-bg-1/95 backdrop-blur-sm">
          <div className="shrink-0 border-b border-neutral-line px-4 py-4">
            <Select
              showSearch
              className="w-full"
              value={selectedFamily || undefined}
              placeholder="Search family..."
              options={familyOptions}
              optionFilterProp="label"
              filterOption={(input, option) => {
                return String(option?.label || '')
                  .toLowerCase()
                  .includes(input.toLowerCase());
              }}
              optionRender={option => {
                const data = option.data as FamilyOption;

                return (
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-neutral-title-1">
                      {data.label}
                    </span>
                    <span className="rounded-full bg-neutral-bg-2 px-2 py-0.5 text-[11px] leading-4 text-neutral-foot">
                      {data.count}
                    </span>
                  </div>
                );
              }}
              onChange={value => {
                setSelectedFamily(value);
                setSelectedMainTab('family');
              }}
            />

            <div>
              <h1 className="mt-4 text-[15px] font-semibold leading-6 text-neutral-title-1">
                Resource Flow
              </h1>
              <p className="mt-1 text-xs leading-5 text-neutral-foot">
                Inspect tracked resources by family, then drill into memory
                state, lifecycle traces, and family-level rollups.
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                allowClear
                value={filterText}
                onChange={event => setFilterText(event.target.value)}
                placeholder={
                  selectedFamily
                    ? `Filter ${selectedFamily} by key or target...`
                    : 'Filter resources by key or target...'
                }
              />
              <Button
                onClick={() => {
                  client?.send('resource-flow-request-snapshot', {});
                }}>
                Refresh
              </Button>
            </div>
          </div>

          <div className="rf-scrollbar min-h-0 flex-1 overflow-auto p-3">
            <ResourceSidebarContent
              filteredResources={filteredResources}
              selectedFamily={selectedFamily}
              selectedResourceId={selectedResourceId}
              onSelectResource={resourceId => {
                setSelectedResourceId(resourceId);
                setSelectedMainTab('resource');
              }}
            />
          </div>
        </aside>

        <main className="flex min-w-0 min-h-0 flex-col">
          <div className="border-b border-neutral-line bg-neutral-bg-1/88 px-5 py-4 backdrop-blur-sm">
            <h2 className="text-[15px] font-semibold leading-6 text-neutral-title-1">
              {mainTitle}
            </h2>
            <p className="mt-1 text-xs leading-5 text-neutral-foot">
              {mainDescription}
            </p>
          </div>

          <div className="rf-scrollbar min-h-0 flex-1 overflow-auto px-5 py-5">
            {!selectedFamily || !selectedFamilySummary ? (
              <div className="flex min-h-full items-center justify-center">
                <Empty
                  description="Once tracked resources arrive, families will appear here."
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            ) : (
              <Tabs
                activeKey={selectedMainTab}
                className="rf-ant-tabs rf-main-tabs"
                items={mainTabItems}
                onChange={key => setSelectedMainTab(key as MainTabKey)}
              />
            )}
          </div>
        </main>
      </div>
    </ConfigProvider>
  );
}
