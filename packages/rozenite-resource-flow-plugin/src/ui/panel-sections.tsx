import { Col, Collapse, Empty, Row, Timeline } from 'antd';
import type { CollapseProps } from 'antd';
import React, { useMemo } from 'react';

import type {
  ResourceFlowResourceSnapshot,
  ResourceFlowTraceEntry,
} from '../shared/types';
import {
  ChainLogo,
  EventDot,
  JsonCard,
  PanelCard,
  StatusTag,
  SummaryStat,
} from './panel-components';
import type {
  AddressBalanceFamilyStats,
  AddressBalanceResourceBreakdown,
  AppChainFamilyStats,
  FamilySummary,
  ResourceTraceSourceInfo,
} from './panel-utils';
import {
  cn,
  formatLabel,
  formatTimestamp,
  parseAppChainResource,
  formatSignedUsd,
  formatUsd,
  getResourceUpdatedAt,
} from './panel-utils';

function BreakdownMetric(props: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'error';
}) {
  return (
    <div className="rounded-xl border border-neutral-line bg-neutral-bg-2 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.06em] text-neutral-foot">
        {props.label}
      </div>
      <div
        className={cn(
          'mt-1 text-sm font-semibold text-neutral-title-1',
          props.tone === 'success' && 'text-green-default',
          props.tone === 'warning' && 'text-orange-default',
          props.tone === 'error' && 'text-red-default',
        )}>
        {props.value}
      </div>
    </div>
  );
}

export function ResourceSidebarContent(props: {
  filteredResources: ResourceFlowResourceSnapshot[];
  resourceTraceSourceInfoById: Record<string, ResourceTraceSourceInfo>;
  selectedFamily: string | null;
  selectedResourceId: string | null;
  onSelectResource: (resourceId: string) => void;
}) {
  const {
    filteredResources,
    onSelectResource,
    resourceTraceSourceInfoById,
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
    <div className="space-y-1.5">
      {filteredResources.map(resource => {
        const isActive = resource.id === selectedResourceId;
        const updatedAt = getResourceUpdatedAt(resource);
        const traceSourceInfo = resourceTraceSourceInfoById[resource.id];
        const appChainResource =
          resource.family === 'appchain'
            ? parseAppChainResource(resource)
            : null;

        return (
          <button
            key={resource.id}
            type="button"
            className={cn(
              'w-full rounded-xl border px-3 py-2.5 text-left transition',
              isActive
                ? 'border-brand-default bg-brand-light-1 shadow-[0_10px_30px_-18px_var(--rf-color-brand-default)]'
                : 'border-transparent bg-transparent hover:border-neutral-line hover:bg-neutral-bg-2/80',
            )}
            onClick={() => onSelectResource(resource.id)}>
            <div className="flex items-start gap-3">
              {appChainResource ? (
                <ChainLogo
                  src={appChainResource.chainLogoUrl}
                  alt={appChainResource.chainName}
                />
              ) : null}

              <div className="min-w-0 flex-1">
                {appChainResource ? (
                  <div className="truncate text-xs font-medium uppercase tracking-[0.06em] text-neutral-foot">
                    {appChainResource.chainName}
                  </div>
                ) : null}
                <div className="break-all text-sm font-medium text-neutral-title-1">
                  {resource.resourceKey}
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[11px] leading-5 text-neutral-foot">
              <span>{traceSourceInfo?.summary || 'n/a'}</span>
              <span>{formatTimestamp(updatedAt)}</span>
            </div>
            {resource.meta.lastError ? (
              <div className="mt-1 line-clamp-1 text-[11px] leading-5 text-red-default">
                {resource.meta.lastError.message}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function FamilySummaryContent(props: {
  selectedFamilySummary: FamilySummary | null;
  appChainFamilyStats: AppChainFamilyStats | null;
  addressBalanceFamilyStats: AddressBalanceFamilyStats | null;
}) {
  const {
    addressBalanceFamilyStats,
    appChainFamilyStats,
    selectedFamilySummary,
  } = props;

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
                    <div className="flex items-center gap-3">
                      <ChainLogo
                        src={item.chainLogoUrl}
                        alt={item.chainName}
                        size={28}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-neutral-title-1">
                          {item.chainName}
                        </div>
                        <div className="mt-1 break-all text-xs text-neutral-foot">
                          {item.chainId} · {item.ownerCount} owner(s)
                        </div>
                      </div>
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

      {addressBalanceFamilyStats ? (
        <>
          <PanelCard
            title="AddressBalance Decomposition"
            className="col-span-full">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryStat
                label="Total Balance"
                value={formatUsd(addressBalanceFamilyStats.totalBalance)}
              />
              <SummaryStat
                label="Recorded EVM"
                value={formatUsd(
                  addressBalanceFamilyStats.totalRecordedEvmBalance,
                )}
              />
              <SummaryStat
                label="AppChain Portion"
                value={formatUsd(addressBalanceFamilyStats.totalAppChainValue)}
                tone="warning"
              />
              <SummaryStat
                label="Comparable Balance"
                value={formatUsd(
                  addressBalanceFamilyStats.totalComparableBalance,
                )}
                tone="success"
              />
              <SummaryStat
                label="Delta Vs EVM"
                value={formatSignedUsd(addressBalanceFamilyStats.totalEvmDelta)}
                tone={
                  Math.abs(addressBalanceFamilyStats.totalEvmDelta) > 0.01
                    ? 'warning'
                    : undefined
                }
              />
            </div>
          </PanelCard>

          <PanelCard title="Per-Address Breakdown" className="col-span-full">
            {!addressBalanceFamilyStats.addresses.length ? (
              <Empty
                description="No address-level balance resources yet."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div className="space-y-3">
                {addressBalanceFamilyStats.addresses.map(item => (
                  <div
                    key={item.address}
                    className="rounded-2xl border border-neutral-line bg-neutral-bg-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="break-all text-sm font-medium text-neutral-title-1">
                        {item.address}
                      </div>
                      <div className="text-[11px] text-neutral-foot">
                        appChain source={item.appChainValueSource}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <BreakdownMetric
                        label="Total"
                        value={formatUsd(item.totalBalance)}
                      />
                      <BreakdownMetric
                        label="Recorded EVM"
                        value={formatUsd(item.recordedEvmBalance)}
                      />
                      <BreakdownMetric
                        label="AppChain"
                        value={formatUsd(item.appChainValue)}
                        tone="warning"
                      />
                      <BreakdownMetric
                        label="Total - AppChain"
                        value={formatUsd(item.comparableBalance)}
                        tone="success"
                      />
                      <BreakdownMetric
                        label="Delta"
                        value={formatSignedUsd(item.evmDelta)}
                        tone={
                          Math.abs(item.evmDelta) > 0.01 ? 'warning' : undefined
                        }
                      />
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
  addressBalanceBreakdown: AddressBalanceResourceBreakdown | null;
  resourceTraceSourceInfo: ResourceTraceSourceInfo | null;
}) {
  const {
    addressBalanceBreakdown,
    resourceTraceSourceInfo,
    selectedResource,
    selectedTraces,
  } = props;

  const resourceMetaItems = useMemo(() => {
    if (!selectedResource) {
      return [];
    }

    const appChainResource =
      selectedResource.family === 'appchain'
        ? parseAppChainResource(selectedResource)
        : null;

    return [
      {
        key: 'resourceKey',
        label: 'Resource Key',
        fullWidth: true,
        children: (
          <div className="break-all">{selectedResource.resourceKey}</div>
        ),
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
        key: 'traceSource',
        label: 'Trace Source',
        children: resourceTraceSourceInfo?.traceSource || 'n/a',
      },
      {
        key: 'endpoint',
        label: 'Endpoint',
        fullWidth: true,
        children: (
          <div className="break-all">
            {resourceTraceSourceInfo?.endpoint || 'n/a'}
          </div>
        ),
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
        fullWidth: true,
        children: (
          <div className="break-all">
            {selectedResource.meta.activeRemoteRequestId || 'n/a'}
          </div>
        ),
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
      ...(appChainResource
        ? [
            {
              key: 'chain',
              label: 'Chain',
              children: (
                <div className="flex items-center gap-2">
                  <ChainLogo
                    src={appChainResource.chainLogoUrl}
                    alt={appChainResource.chainName}
                    size={22}
                  />
                  <span>{appChainResource.chainName}</span>
                </div>
              ),
            },
            {
              key: 'chainId',
              label: 'Chain Id',
              fullWidth: true,
              children: (
                <div className="break-all">{appChainResource.chainId}</div>
              ),
            },
          ]
        : []),
    ];
  }, [resourceTraceSourceInfo, selectedResource]);

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
    <Row gutter={[16, 16]} align="top">
      <Col xs={24} xxl={14}>
        <div className="space-y-4">
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={addressBalanceBreakdown ? 12 : 24}>
              <PanelCard title="Current Meta">
                <Row gutter={[16, 16]}>
                  {resourceMetaItems.map(item => (
                    <Col key={item.key} xs={24} lg={item.fullWidth ? 24 : 12}>
                      <div className="rounded-xl border border-neutral-line bg-neutral-bg-2 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.06em] text-neutral-foot">
                          {item.label}
                        </div>
                        <div className="mt-1 text-sm font-medium leading-6 text-neutral-title-1">
                          {item.children}
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </PanelCard>
            </Col>

            {addressBalanceBreakdown ? (
              <Col xs={24} xl={12}>
                <PanelCard title="AddressBalance Decomposition">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <SummaryStat
                      label="Total Balance"
                      value={formatUsd(addressBalanceBreakdown.totalBalance)}
                    />
                    <SummaryStat
                      label="Recorded EVM"
                      value={formatUsd(
                        addressBalanceBreakdown.recordedEvmBalance,
                      )}
                    />
                    <SummaryStat
                      label="AppChain Portion"
                      value={formatUsd(addressBalanceBreakdown.appChainValue)}
                      tone="warning"
                    />
                    <SummaryStat
                      label="Comparable Balance"
                      value={formatUsd(
                        addressBalanceBreakdown.comparableBalance,
                      )}
                      tone="success"
                    />
                    <SummaryStat
                      label="Delta Vs EVM"
                      value={formatSignedUsd(addressBalanceBreakdown.evmDelta)}
                      tone={
                        Math.abs(addressBalanceBreakdown.evmDelta) > 0.01
                          ? 'warning'
                          : undefined
                      }
                    />
                    <SummaryStat
                      label="AppChain Source"
                      value={addressBalanceBreakdown.appChainValueSource}
                    />
                  </div>
                </PanelCard>
              </Col>
            ) : null}
          </Row>

          <JsonCard
            title="Current Memory Value"
            value={selectedResource.value}
          />
          <JsonCard
            title="Local Targets"
            value={selectedResource.meta.localTargets}
          />
          <JsonCard
            title="Last Error"
            value={selectedResource.meta.lastError}
          />
        </div>
      </Col>

      <Col xs={24} xxl={10}>
        <PanelCard title="Event Timeline">
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
      </Col>
    </Row>
  );
}
