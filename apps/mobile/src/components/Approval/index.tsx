import { useApproval } from '@/hooks/useApproval';
import { IExtractFromPromise } from '@/utils/type';
import React from 'react';
import { View } from 'react-native';

import * as ApprovalComponent from './components';

export const Approval = () => {
  const [getApproval, ,] = useApproval();
  type IApproval = Exclude<
    IExtractFromPromise<ReturnType<typeof getApproval>>,
    void
  >;
  const [approval, setApproval] = React.useState<IApproval | null>(null);

  const init = async () => {
    const _approval = await getApproval();
    if (!_approval) {
      // history.replace('/');
      return null;
    }
    setApproval(_approval);
  };

  React.useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!approval) {
    return <View />;
  }
  const { data } = approval;
  const { approvalComponent, params, origin } = data;
  const CurrentApprovalComponent = ApprovalComponent[approvalComponent];

  return <CurrentApprovalComponent params={params} origin={origin} />;
};
