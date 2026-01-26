import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  DappFrameAccountHeader,
  DappSelectItem,
} from '@/components2024/DappFrameAccountHeader';
import DappWebViewCore from '@/components/WebView/DappWebViewCore';
import { apisDapp } from '@/core/apis';
import { useAccounts } from '@/hooks/account';
import { useDappsValue, getDappAccount } from '@/hooks/useDapps';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { Account } from '@/core/services/preference';

type InnerDappWebViewScreenProps = {
  list: DappSelectItem[];
  activeId: string;
  onSelectDapp: (item: DappSelectItem) => void;
  dappSelectTitle?: string;
  rightAddon?: React.ReactNode;
  renderWebView?: boolean;
};

export const InnerDappWebViewScreen = ({
  list,
  activeId,
  onSelectDapp,
  dappSelectTitle,
  rightAddon,
  renderWebView = true,
}: InnerDappWebViewScreenProps) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { bottom } = useSafeAreaInsets();
  const { dapps } = useDappsValue();
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  useEffect(() => {
    console.log('mount');
    return () => {
      console.log('unmount');
    };
  }, []);

  const activeItem = useMemo(() => {
    if (!list.length) {
      return undefined;
    }
    return list.find(item => item.id === activeId) || list[0];
  }, [activeId, list]);

  const dappOrigin = useMemo(() => {
    if (!activeItem?.url) {
      return undefined;
    }
    return safeGetOrigin(activeItem.url) || activeItem.url;
  }, [activeItem?.url]);

  const dappInfo = useMemo(() => {
    return dappOrigin ? dapps[dappOrigin] : undefined;
  }, [dapps, dappOrigin]);

  const account = useMemo(() => {
    return getDappAccount({ dappInfo, accounts });
  }, [accounts, dappInfo]);

  const handleSelectAccount = (nextAccount: Account) => {
    if (!dappOrigin) {
      return;
    }
    apisDapp.setCurrentAccountForDapp(dappOrigin, nextAccount);
  };

  if (!activeItem?.url) {
    return null;
  }
  if (!dappOrigin) {
    return null;
  }

  return (
    <NormalScreenContainer2024 type={isLight ? 'bg0' : 'bg1'}>
      <DappFrameAccountHeader
        account={account || undefined}
        onSelectAccount={handleSelectAccount}
        activeId={activeItem.id}
        dAppList={list}
        onSelectDapp={onSelectDapp}
        dappSelectTitle={dappSelectTitle}
        rightAddon={rightAddon}
      />
      {renderWebView ? (
        <View style={[styles.webviewWrapper]}>
          <DappWebViewCore
            dappOrigin={dappOrigin}
            url={activeItem.url}
            webviewKey={activeItem.id}
          />
        </View>
      ) : null}
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(() => ({
  webviewWrapper: {
    flex: 1,
  },
}));
