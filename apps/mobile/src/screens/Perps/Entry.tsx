import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  DappSelectItem,
  INNER_DAPP_LIST,
} from '@/components2024/DappFrameAccountHeader';
import { InnerDappWebViewScreen } from '@/components2024/InnerDappWebViewScreen';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { PerpsOriginScreen } from './index';
import { Account } from '@/core/services/preference';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { apisDapp } from '@/core/apis';
import { createDappBySession } from '@/core/apis/dapp';
import { dappService } from '@/core/services';
import { noop } from 'lodash';
import { switchPerpsAccountBeforeNavigate } from '@/hooks/perps/usePerpsStore';
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
import { useTranslation } from 'react-i18next';

const PERPS_LIST = INNER_DAPP_LIST.PERPS;
const DEFAULT_PERPS_ID = PERPS_LIST[0]?.id ?? 'hyperliquid';

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

type PerpsRouteProps = CompositeScreenProps<
  NativeStackScreenProps<TransactionNavigatorParamList, 'Perps'>,
  NativeStackScreenProps<RootStackParamsList>
>;

export function PerpsScreen() {
  const { t } = useTranslation();
  const { perps, setPerps } = useInnerDappSelection();
  const route = useRoute<PerpsRouteProps['route']>();

  const navigation = useNavigation<PerpsRouteProps['navigation']>();
  const navState = route.params;

  const activeId = useMemo(() => resolveActiveId(PERPS_LIST, perps), [perps]);
  const activeItem = useMemo(
    () => PERPS_LIST.find(item => item.id === activeId) || PERPS_LIST[0],
    [activeId],
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
      dappId && PERPS_LIST.some(item => item.id === dappId)
        ? dappId
        : undefined;
    if (nextId && nextId !== perps) {
      setPerps(nextId);
      resumeRef.current = () => {
        let originPerps = perps;
        if (!resetRef.current) {
          setPerps(originPerps);
        }
      };
    }

    if (account) {
      const resolvedId = resolveActiveId(
        PERPS_LIST,
        nextId || perps || DEFAULT_PERPS_ID,
      );
      if (resolvedId === DEFAULT_PERPS_ID) {
      } else {
        const item = PERPS_LIST.find(i => i.id === resolvedId);
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
  }, [navState, perps, setPerps, navigation]);

  useEffect(() => {
    return () => {
      resumeRef.current?.();
    };
  }, []);

  const handleSelectDapp = useCallback(
    (item: DappSelectItem) => {
      setPerps(item.id);
    },
    [setPerps],
  );

  if (!activeId) {
    return null;
  }

  if (activeItem?.id !== DEFAULT_PERPS_ID) {
    return (
      <InnerDappWebViewScreen
        list={PERPS_LIST}
        activeId={activeId}
        onSelectDapp={handleSelectDapp}
        renderWebView={false}
        dappSelectTitle={t('page.perps.dappSelect.title')}
      />
    );
  }

  return (
    <PerpsOriginScreen
      activeId={activeId}
      dappList={PERPS_LIST}
      onSelectDapp={handleSelectDapp}
      dappSelectTitle={t('page.perps.dappSelect.title')}
    />
  );
}
