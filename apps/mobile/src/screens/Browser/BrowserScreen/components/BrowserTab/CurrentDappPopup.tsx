import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { RcIconDisconnectCC } from '@/assets/icons/dapp';
import { AppBottomSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AccountSelector } from '@/components2024/AccountSelector';
import { ChainSelector } from '@/components2024/ChainSelector';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { createGetStyles2024 } from '@/utils/styles';
import { CHAINS_ENUM } from '@debank/common';
import { useTranslation } from 'react-i18next';
import { preferenceService } from '@/core/services';
import { apisDapp } from '@/core/apis';
import { useMyAccounts } from '@/hooks/account';
import { Account } from '@/core/services/preference';

interface Props {
  visible?: boolean;
  onClose?: () => void;
  dapp: DappInfo;
  account?: Account;
}

export function CurrentDappPopup({ visible, onClose, dapp, account }: Props) {
  const { colors2024, styles, isLight } = useTheme2024({
    getStyle,
  });

  const { t } = useTranslation();

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={[400]}
      onDismiss={() => {
        onClose?.();
      }}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      <AutoLockView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('page.browser.CurrentPopup.title')}
          </Text>
        </View>
        <View style={styles.body}>
          <View style={styles.connectContent}>
            <View style={styles.connectCard}>
              <DappIcon
                origin={dapp.origin}
                source={
                  dapp.icon || dapp.info?.logo_url
                    ? { uri: dapp.icon || dapp.info?.logo_url || '' }
                    : undefined
                }
                style={styles.dappIcon}
              />
              <Text style={styles.connectOrigin}>{dapp.origin}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelText}>
                {t('page.browser.CurrentPopup.connectChain')}
              </Text>
              <View>
                <ChainSelector
                  account={account}
                  value={dapp.chainId || CHAINS_ENUM.ETH}
                  onChange={v => {
                    apisDapp.updateDappChain({
                      ...dapp,
                      chainId: v,
                    });
                  }}
                />
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.labelText}>
                {t('page.browser.CurrentPopup.connectWallet')}
              </Text>
              <View style={styles.rowValue}>
                <AccountSelector
                  value={account}
                  onChange={v => {
                    apisDapp.setCurrentAccountForDapp(dapp.origin, v);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              apisDapp.disconnect(dapp.origin);
              onClose?.();
            }}>
            <RcIconDisconnectCC color={colors2024['red-default']} />
            <Text style={styles.buttonText}>
              {t('page.browser.CurrentPopup.disconnect')}
            </Text>
          </TouchableOpacity>
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}
const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  handleStyle: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
  container: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  dappIcon: {
    width: 23,
    height: 23,
    borderRadius: 4,
  },
  body: {
    flex: 1,
  },
  connectContent: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginHorizontal: 16,
  },
  connectCard: {
    padding: 23,
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  connectOrigin: {
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  labelText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  rowValue: {
    flexShrink: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  button: {
    borderRadius: 16,
    backgroundColor: colors2024['red-light-1'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
  },
  buttonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors2024['red-default'],
  },
}));
