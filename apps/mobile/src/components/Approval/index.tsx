import { useApproval } from '@/hooks/useApproval';
import {
  eventBus,
  EVENT_ACTIVE_WINDOW,
  EventBusListeners,
} from '@/utils/events';
import { IExtractFromPromise } from '@/utils/type';
import React from 'react';
import { Text, View } from 'react-native';
import { removeGlobalBottomSheetModal } from '../GlobalBottomSheetModal';
import { ApprovalComponent } from './components';
import { useOpenedActiveDappState } from '@/screens/Dapps/hooks/useDappView';
import {
  isInternalSession,
  shouldAllowApprovePopupByOrigin,
  shouldAllowApprovePopupByTabId,
} from '@/core/bridges/state';
// import TouchableText from '../Touchable/TouchableText';

function ShouldntRenderApproveDueToDappDisappeared() {
  return (
    <View
      style={{
        flex: 1,
        height: '100%',
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text>No approve found</Text>
        {/* <TouchableText style={{ marginLeft: 6, textDecorationLine: 'underline' }} onPress={() => {
        specificGlobalSheetModalEvents.emit('cancelDappApproval');
      }}>
        Close
      </TouchableText> */}
      </View>
    </View>
  );
}

export const Approval = () => {
  const [getApproval, ,] = useApproval();
  type IApproval = Exclude<
    IExtractFromPromise<ReturnType<typeof getApproval>>,
    void
  >;
  const [approval, setApproval] = React.useState<IApproval | null>(null);

  const init = React.useCallback<EventBusListeners['EVENT_ACTIVE_WINDOW']>(
    async winId => {
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

  const { activeTabId, activeDappOrigin } = useOpenedActiveDappState();

  if (!approval) {
    return <View />;
  }

  console.debug('[Approval] approval', approval);
  const { data } = approval;
  const { approvalComponent, params, origin, account } = data;

  const fromTabId =
    params.$mobileCtx?.fromTabId ||
    data.$mobileCtx?.fromTabId ||
    params?.session?.$mobileCtx?.fromTabId;

  const fromOrigin = origin || params.origin;
  const shouldDisallow =
    !isInternalSession(fromOrigin) &&
    !shouldAllowApprovePopupByTabId({
      fromTabId,
      currentActiveId: activeTabId,
    });
  const shouldAllowForLegacy =
    !__DEV__ &&
    shouldAllowApprovePopupByOrigin(
      { fromOrigin, currentActiveOrigin: activeDappOrigin },
      { allowSecondaryDomainMatch: false },
    );

  if (shouldDisallow && !shouldAllowForLegacy) {
    return <ShouldntRenderApproveDueToDappDisappeared />;
  }

  const CurrentApprovalComponent =
    ApprovalComponent[approvalComponent] ?? ApprovalComponent.Unknown;

  return (
    <CurrentApprovalComponent
      params={params}
      origin={origin}
      account={account}
    />
  );
};
