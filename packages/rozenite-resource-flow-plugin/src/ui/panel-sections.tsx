import { Collapse, Descriptions, Empty, Timeline } from 'antd';
import type { CollapseProps } from 'antd';
import React, { useMemo } from 'react';

import type {
  ResourceFlowResourceSnapshot,
  ResourceFlowTraceEntry,
} from '../shared/types';
import {
  EventDot,
  JsonCard,
  PanelCard,
  StatusTag,
  SummaryStat,
} from './panel-components';
import type { AppChainFamilyStats, FamilySummary } from './panel-utils';
import {
  cn,
  formatLabel,
  formatTimestamp,
  formatUsd,
  getResourceUpdatedAt,
} from './panel-utils';

export function ResourceSidebarContent(props: {
  filteredResources: ResourceFlowResourceSnapshot[];
  selectedFamily: string | null;
  selectedResourceId: string | null;
  onSelectResource: (resourceId: string) => void;
}) {
  const {
    filteredResources,
    onSelectResource,
    selectedFamily,
    selectedResourceId,
  } = props;

  if (!selectedFamily) {
    return (
      <div className="flex min-h-[220px] items-center justify-center">
        <Empty
          description="No tracked resources yet."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  if (!filteredResources.length) {
    return (
      <div className="flex min-h-[220px] items-center justify-center">
        <Empty
          description="No resource matched in this family."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredResources.map(resource => {
        const isActive = resource.id === selectedResourceId;

        return (
          <button
            key={resource.id}
            type="button"
            className={cn(
              'w-full rounded-2xl border p-3 text-left transition',
              isActive
                ? 'border-brand-default bg-brand-light-1 shadow-[0_10px_30px_-18px_var(--rf-color-brand-default)]'
                : 'border-transparent bg-transparent hover:border-neutral-line hover:bg-neutral-bg-2',
            )}
            onClick={() => onSelectResource(resource.id)}>
            <div className="flex items-center justify-between gap-3">
              <StatusTag status={resource.meta.persistStatus} />
              <span className="text-[11px] text-neutral-foot">
                v{resource.meta.version}
              </span>
            </div>
            <div className="mt-3 break-all text-sm font-medium text-neutral-title-1">
              {resource.resourceKey}
            </div>
            <div className="mt-2 text-xs leading-5 text-neutral-body">
              source={resource.meta.sourceOfCurrentValue || 'n/a'} · updated=
              {formatTimestamp(getResourceUpdatedAt(resource))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function FamilySummaryContent(props: {
  selectedFamilySummary: FamilySummary | null;
  appChainFamilyStats: AppChainFamilyStats | null;
}) {
  const { appChainFamilyStats, selectedFamilySummary } = props;

  if (!selectedFamilySummary) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Empty
          description="No family selected."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <PanelCard title="Family Summary" className="col-span-full">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryStat
            label="Tracked Resources"
            value={String(selectedFamilySummary.resourceCount)}
          />
          <SummaryStat
            label="Ready Values"
            value={String(selectedFamilySummary.valueCount)}
            tone="success"
          />
          <SummaryStat
            label="Loading"
            value={String(selectedFamilySummary.loadingCount)}
            tone={selectedFamilySummary.loadingCount ? 'warning' : undefined}
          />
          <SummaryStat
            label="With Error"
            value={String(selectedFamilySummary.errorCount)}
            tone={selectedFamilySummary.errorCount ? 'error' : undefined}
          />
          <SummaryStat
            label="Trace Entries"
            value={String(selectedFamilySummary.traceCount)}
          />
          <SummaryStat
            label="Last Updated"
            value={formatTimestamp(selectedFamilySummary.latestUpdatedAt)}
          />
        </div>
      </PanelCard>

      {appChainFamilyStats ? (
        <>
          <PanelCard title="AppChain Rollup" className="col-span-full">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryStat
                label="Total USD Value"
                value={formatUsd(appChainFamilyStats.totalUsdValue)}
                tone="success"
              />
              <SummaryStat
                label="Addresses"
                value={String(appChainFamilyStats.uniqueAddressCount)}
              />
              <SummaryStat
                label="Chains"
                value={String(appChainFamilyStats.uniqueChainCount)}
              />
            </div>
          </PanelCard>

          <PanelCard
            title="Address Totals In Current Family"
            className="col-span-full xl:col-span-1">
            {!appChainFamilyStats.addressTotals.length ? (
              <Empty
                description="No address-level totals yet."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div className="space-y-3">
                {appChainFamilyStats.addressTotals.map(item => (
                  <div
                    key={item.ownerAddr}
                    className="rounded-2xl border border-neutral-line bg-neutral-bg-2 p-4">
                    <div className="break-all text-sm font-medium text-neutral-title-1">
                      {item.ownerAddr}
                    </div>
                    <div className="mt-1 text-xs text-neutral-foot">
                      {item.chainCount} chain(s)
                    </div>
                    <div className="mt-3 text-right text-sm font-semibold text-brand-default">
                      {formatUsd(item.totalUsdValue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>

          <PanelCard
            title="Chain Totals In Current Family"
            className="col-span-full xl:col-span-1">
            {!appChainFamilyStats.chainTotals.length ? (
              <Empty
                description="No chain-level totals yet."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div className="space-y-3">
                {appChainFamilyStats.chainTotals.map(item => (
                  <div
                    key={item.chainId}
                    className="rounded-2xl border border-neutral-line bg-neutral-bg-2 p-4">
                    <div className="text-sm font-medium text-neutral-title-1">
                      {item.chainName}
                    </div>
                    <div className="mt-1 break-all text-xs text-neutral-foot">
                      {item.chainId} · {item.ownerCount} owner(s)
                    </div>
                    <div className="mt-3 text-right text-sm font-semibold text-brand-default">
                      {formatUsd(item.totalUsdValue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>
        </>
      ) : null}
    </div>
  );
}

export function ResourceDetailContent(props: {
  selectedResource: ResourceFlowResourceSnapshot | null;
  selectedTraces: ResourceFlowTraceEntry[];
}) {
  const { selectedResource, selectedTraces } = props;

  const resourceMetaItems = useMemo(() => {
    if (!selectedResource) {
      return [];
    }

    return [
      {
        key: 'resourceKey',
        label: 'Resource Key',
        children: selectedResource.resourceKey,
      },
      {
        key: 'hasValue',
        label: 'Has Value',
        children: String(selectedResource.meta.hasValue),
      },
      {
        key: 'source',
        label: 'Source',
        children: selectedResource.meta.sourceOfCurrentValue || 'n/a',
      },
      {
        key: 'version',
        label: 'Version',
        children: selectedResource.meta.version,
      },
      {
        key: 'hydrating',
        label: 'Hydrating',
        children: String(selectedResource.meta.isHydrating),
      },
      {
        key: 'fetchingRemote',
        label: 'Fetching Remote',
        children: String(selectedResource.meta.isFetchingRemote),
      },
      {
        key: 'persistStatus',
        label: 'Persist Status',
        children: <StatusTag status={selectedResource.meta.persistStatus} />,
      },
      {
        key: 'activeRequest',
        label: 'Active Request',
        children: selectedResource.meta.activeRemoteRequestId || 'n/a',
      },
      {
        key: 'lastHydrated',
        label: 'Last Hydrated',
        children: formatTimestamp(selectedResource.meta.lastHydratedAt),
      },
      {
        key: 'lastRemote',
        label: 'Last Remote',
        children: formatTimestamp(selectedResource.meta.lastRemoteAt),
      },
      {
        key: 'lastPersist',
        label: 'Last Persist',
        children: formatTimestamp(selectedResource.meta.lastPersistAt),
      },
    ];
  }, [selectedResource]);

  const traceCollapseItems = useMemo<
    NonNullable<CollapseProps['items']>
  >(() => {
    return selectedTraces.map(trace => ({
      key: trace.id,
      label: (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusTag status={trace.type} />
            <span className="text-sm font-medium text-neutral-title-1">
              {formatLabel(trace.type)}
            </span>
          </div>
          <span className="text-xs text-neutral-foot">
            {formatTimestamp(trace.at)}
          </span>
        </div>
      ),
      children: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <JsonCard title="Detail" value={trace.detail || null} />
            <JsonCard title="Local Targets" value={trace.localTargets || []} />
          </div>
          {trace.error ? <JsonCard title="Error" value={trace.error} /> : null}
          <div className="text-xs text-neutral-foot">
            request={trace.requestId || 'n/a'}
          </div>
        </div>
      ),
    }));
  }, [selectedTraces]);

  if (!selectedResource) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Empty
          description="Select a resource from the left list to inspect details."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <PanelCard title="Current Meta" className="col-span-full xl:col-span-1">
        <Descriptions
          bordered={false}
          colon={false}
          size="small"
          column={{ xs: 1, xl: 2 }}
          items={resourceMetaItems}
        />
      </PanelCard>

      <JsonCard title="Current Memory Value" value={selectedResource.value} />
      <JsonCard
        title="Local Targets"
        value={selectedResource.meta.localTargets}
      />
      <JsonCard title="Last Error" value={selectedResource.meta.lastError} />

      <PanelCard title="Event Timeline" className="col-span-full">
        {!traceCollapseItems.length ? (
          <Empty
            description="No trace yet for this resource."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Timeline
            className="rf-trace-timeline"
            items={selectedTraces.map(trace => ({
              dot: <EventDot status={trace.type} />,
              children: (
                <Collapse
                  ghost
                  className="rf-event-collapse"
                  expandIconPosition="end"
                  items={traceCollapseItems.filter(
                    item => item?.key === trace.id,
                  )}
                />
              ),
            }))}
          />
        )}
      </PanelCard>
    </div>
  );
}
