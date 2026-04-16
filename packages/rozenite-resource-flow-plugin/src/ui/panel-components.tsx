import { Card, Tag } from 'antd';
import React from 'react';

import { cn, formatLabel, getStatusTone, toJson } from './panel-utils';

export function PanelCard(props: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      title={props.title}
      className={cn(
        'rf-card h-full border-neutral-line bg-neutral-bg-1 shadow-none',
        props.className,
      )}>
      {props.children}
    </Card>
  );
}

export function JsonCard(props: { title: string; value: unknown }) {
  return (
    <PanelCard title={props.title} className="col-span-full">
      <pre className="rf-json text-xs leading-5 text-neutral-body">
        {toJson(props.value)}
      </pre>
    </PanelCard>
  );
}

export function SummaryStat(props: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'error';
}) {
  return (
    <div className="rounded-2xl border border-neutral-line bg-neutral-bg-2 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-foot">
        {props.label}
      </div>
      <div
        className={cn(
          'mt-2 text-lg font-semibold text-neutral-title-1',
          props.tone === 'success' && 'text-green-default',
          props.tone === 'warning' && 'text-orange-default',
          props.tone === 'error' && 'text-red-default',
        )}>
        {props.value}
      </div>
    </div>
  );
}

export function StatusTag(props: { status?: string }) {
  return (
    <Tag className="!m-0 !rounded-full" color={getStatusTone(props.status)}>
      {formatLabel(props.status)}
    </Tag>
  );
}

export function EventDot(props: { status?: string }) {
  return (
    <span
      className={cn(
        'mt-1 inline-flex h-3 w-3 rounded-full border-2 border-neutral-bg-1',
        getStatusTone(props.status) === 'success' && 'bg-green-default',
        getStatusTone(props.status) === 'warning' && 'bg-orange-default',
        getStatusTone(props.status) === 'error' && 'bg-red-default',
        getStatusTone(props.status) === 'processing' && 'bg-blue-default',
        getStatusTone(props.status) === 'default' && 'bg-neutral-secondary',
      )}
    />
  );
}
