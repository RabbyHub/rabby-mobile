import { useApproval } from '@/hooks/useApproval';
import { eventBus, EVENT_ACTIVE_WINDOW } from '@/utils/events';
import { IExtractFromPromise } from '@/utils/type';
import React from 'react';
import { View } from 'react-native';
import { removeGlobalBottomSheetModal } from '../GlobalBottomSheetModal';
import * as ApprovalComponent from './components';
import { useOpenedActiveDappState } from '@/screens/Dapps/hooks/useDappView';
import { getActiveDappTabId } from '@/core/bridges/state';

export const Approval = () => {
  const [getApproval, ,] = useApproval();
  type IApproval = Exclude<
    IExtractFromPromise<ReturnType<typeof getApproval>>,
    void
  >;
  const [approval, setApproval] = React.useState<IApproval | null>(null);

  const init = React.useCallback(
    async (winId?: string) => {
      setApproval(null);
      const _approval = await getApproval();
      if (!_approval) {
        removeGlobalBottomSheetModal(winId);
        return null;
      }
      setApproval(_approval);
    },
    [getApproval],
  );

  React.useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    eventBus.on(EVENT_ACTIVE_WINDOW, init);

    return () => {
      eventBus.off(EVENT_ACTIVE_WINDOW, init);
    };
  }, [init]);

  if (!getActiveDappTabId() || !approval) {
    return <View />;
  }
  const { data } = approval;
  const { approvalComponent, params, origin } = data;

  // const sourceOrigin = origin || params.origin;
  // if (
  //   !shouldAllowApprovePopup({
  //     targetOrigin: sourceOrigin,
  //     currentActiveOrigin: activeDappOrigin,
  //   })
  // ) {
  //   return <View />;
  // }

  const CurrentApprovalComponent =
    ApprovalComponent[approvalComponent] ?? ApprovalComponent.Unknown;

  return <CurrentApprovalComponent params={params} origin={origin} />;
};
