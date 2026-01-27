import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  DappSelectItem,
  INNER_DAPP_LIST,
} from '@/components2024/DappFrameAccountHeader';
import { InnerDappWebViewScreen } from '@/components2024/InnerDappWebViewScreen';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { Account } from '@/core/services/preference';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { apisDapp } from '@/core/apis';
import { createDappBySession } from '@/core/apis/dapp';
import { dappService } from '@/core/services';

import { LendingNativeScreen } from './';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { noop } from 'lodash';
import {
  CompositeScreenProps,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import {
  RootStackParamsList,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

const LENDING_LIST = INNER_DAPP_LIST.LENDING;
const DEFAULT_LENDING_ID = LENDING_LIST[0]?.id ?? 'aave';

const resolveActiveId = (list: DappSelectItem[], preferredId: string) => {
  if (!list.length) {
    return preferredId;
  }
  if (list.some(item => item.id === preferredId)) {
    return preferredId;
  }
  return list[0]?.id;
};

const ensureDappAccount = (origin: string, name: string, account: Account) => {
  if (!dappService.getDapp(origin)) {
    dappService.addDapp({
      ...createDappBySession({
        origin,
        name,
        icon: '',
      }),
      isDapp: true,
      currentAccount: account,
    });
    return;
  }
  apisDapp.setCurrentAccountForDapp(origin, account);
};

type LendingRouteProps = CompositeScreenProps<
  NativeStackScreenProps<TransactionNavigatorParamList, 'Lending'>,
  NativeStackScreenProps<RootStackParamsList>
>;

export function LendingEntryScreen() {
  const { lending, setLending } = useInnerDappSelection();
  const route = useRoute<LendingRouteProps['route']>();

  const navigation = useNavigation<LendingRouteProps['navigation']>();
  const navState = route.params;

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const activeId = useMemo(
    () => resolveActiveId(LENDING_LIST, lending),
    [lending],
  );
  const activeItem = useMemo(
    () => LENDING_LIST.find(item => item.id === activeId) || LENDING_LIST[0],
    [activeId],
  );

  const handleSelectDapp = useCallback(
    (item: DappSelectItem) => {
      setLending(item.id);
      if (!resetRef.current) {
        resetRef.current = true;
      }
    },
    [setLending],
  );
  const resetRef = useRef(true);
  const resumeRef = useRef(noop);

  useEffect(() => {
    if (!navState?.dappId) {
      return;
    }

    resetRef.current = false;

    const { dappId, account } = navState;
    const nextId =
      dappId && LENDING_LIST.some(item => item.id === dappId)
        ? dappId
        : undefined;

    if (nextId && nextId !== lending) {
      setLending(nextId);

      resumeRef.current = () => {
        let originLending = lending;
        if (!resetRef.current) {
          setLending(originLending);
        }
      };
    }

    if (account) {
      const resolvedId = resolveActiveId(
        LENDING_LIST,
        nextId || lending || DEFAULT_LENDING_ID,
      );
      if (resolvedId === DEFAULT_LENDING_ID) {
      } else {
        const item = LENDING_LIST.find(i => i.id === resolvedId);
        if (item?.url) {
          const origin = safeGetOrigin(item.url) || item.url;
          if (origin) {
            ensureDappAccount(origin, item.name, account);
          }
        }
      }
    }
    navigation.setParams({
      account: undefined,
      dappId: undefined,
    });
  }, [lending, setLending, navState, navigation]);

  useEffect(() => {
    return () => {
      resumeRef.current?.();
    };
  }, []);

  if (!activeId) {
    return null;
  }

  if (activeItem?.id !== DEFAULT_LENDING_ID) {
    return (
      <InnerDappWebViewScreen
        list={LENDING_LIST}
        activeId={activeId}
        onSelectDapp={handleSelectDapp}
        renderWebView={false}
      />
    );
  }

  return (
    <LendingNativeScreen
      activeId={activeId}
      dappList={LENDING_LIST}
      onSelectDapp={handleSelectDapp}
    />
  );
}

const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof LendingEntryScreen>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'Lending',
        ofScreen: 'Lending',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-Lending`,
      }}>
      <LendingEntryScreen {...props} />
    </ScreenSceneAccountProvider>
  );
};

export default ForMultipleAddress;
