import React from 'react';
import type { Approval } from '@/core/services/notification';

export const ApprovalIdentityContext = React.createContext<{
  id: string;
  component: Approval['data']['approvalComponent'];
} | null>(null);
