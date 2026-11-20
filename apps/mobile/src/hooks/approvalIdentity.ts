import React from 'react';
import type { Approval } from '@/core/services/notification';

export type ApprovalIdentity = {
  id: string;
  component: Approval['data']['approvalComponent'];
};

export const ApprovalIdentityContext =
  React.createContext<ApprovalIdentity | null>(null);

export const matchesApprovalIdentity = (
  approval: Approval | null,
  identity: ApprovalIdentity | null,
) =>
  !!approval &&
  !!identity &&
  approval.id === identity.id &&
  approval.data.approvalComponent === identity.component;
