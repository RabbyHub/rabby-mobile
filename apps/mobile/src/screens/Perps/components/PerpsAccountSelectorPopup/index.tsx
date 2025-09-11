import { RcIconCorrectCC } from '@/assets/icons/common';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useAccountSelectorList } from '@/components2024/AccountSelector/useAccountSelectorList';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { apisPerps } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { isSameAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import { ellipsisAddress } from '@/utils/address';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useMemoizedFn, useRequest } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

export const PerpsAccountSelectorPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  value?: Account | null;
  onChange?: (a: Account) => void;
  title?: React.ReactNode;
}> = ({ visible, onClose, value, onChange, title }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getModalStyle,
  });

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const { data: lastUsdeAccount, runAsync: runGetLastUsedAccount } = useRequest(
    () => {
      return apisPerps.getPerpsLastUsedAccount();
    },
    {
      manual: true,
    },
  );

  const { myAddresses } = useAccountSelectorList({
    selectedAccount: value,
  });

  const [tmpSelectAccount, setTmpSelectAccount] = useState<Account | null>(
    null,
  );

  const {
    loading,
    runAsync: runSelect,
    cancel: cancelSelect,
  } = useRequest(
    async (value: Account) => {
      await onChange?.(value);
    },
    {
      manual: true,
    },
  );

  const handleSelect = useMemoizedFn((value: Account) => {
    if (loading) {
      return;
    }
    setTmpSelectAccount(value);
    runSelect(value);
  });

  useEffect(() => {
    if (!visible) {
      setTmpSelectAccount(null);
      cancelSelect();
    } else {
      runGetLastUsedAccount();
    }
  }, [cancelSelect, runGetLastUsedAccount, visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={onClose}
      enableDynamicSizing
      enableContentPanningGesture
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView>
        <AutoLockView style={[styles.container]}>
          <View>
            <Text style={styles.title}>{title || 'Select Account'}</Text>
          </View>
          {myAddresses?.map(item => {
            const usdValue = (() => {
              const b = item.balance || 0;
              return `$${splitNumberByStep(
                b > 10 ? Math.floor(b) : b.toFixed(2),
              )}`;
            })();

            const isCurrent = isSameAccount(item, value);
            return (
              <TouchableOpacity
                key={`${item.address}-${item.type}-${item.brandName}`}
                onPress={() => {
                  handleSelect(item);
                }}>
                <AddressItemShadowView
                  // disableShadow
                  style={[
                    styles.addressItemView,
                    // style,
                    // isCurrent || isPressing ? styles.active : null,
                  ]}>
                  <View style={styles.addressItemInner}>
                    <WalletIcon
                      borderRadius={12}
                      width={46}
                      height={46}
                      style={styles.walletIcon}
                      address={item.address}
                      type={item.brandName}
                    />
                    <View style={styles.centerInfo}>
                      <View style={styles.nameAndAdderss}>
                        <Text style={styles.addressText}>
                          {item.aliasName || ellipsisAddress(item.address)}
                        </Text>
                      </View>
                      <View style={styles.bottomArea}>
                        <Text style={styles.balanceText}>{usdValue}</Text>
                      </View>
                    </View>
                    <View style={styles.rightArea}>
                      {loading && isSameAccount(item, tmpSelectAccount) ? (
                        <ActivityIndicator />
                      ) : isSameAddress(
                          item.address,
                          lastUsdeAccount?.address || '',
                        ) && item.type === lastUsdeAccount?.type ? (
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>
                            {t('page.perps.PerpsAccountSelectorPopup.lastUsed')}
                          </Text>
                        </View>
                      ) : (
                        <>
                          {isCurrent ? (
                            <RcIconCorrectCC
                              color={colors2024['green-default']}
                              width={16}
                              height={16}
                            />
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>
                </AddressItemShadowView>
              </TouchableOpacity>
            );
          })}
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getModalStyle = createGetStyles2024(ctx => {
  const { colors2024 } = ctx;
  return {
    handleStyle: {
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-0']
        : ctx.colors2024['neutral-bg-1'],
      paddingTop: 10,
      height: 36,
    },
    container: {
      // height: '100%',
      minHeight: 364,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-0']
        : ctx.colors2024['neutral-bg-1'],
      paddingHorizontal: 20,
      // display: 'flex',
      // flexDirection: 'column',
      paddingBottom: 36,
    },
    title: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      marginBottom: 20,
      textAlign: 'center',
    },
    list: {
      // flex: 1,
      // height: '100%',
      paddingBottom: 56,
    },
    listContent: {
      // paddingBottom: 36,
    },
    panelContainer: {
      position: 'relative',
      width: '100%',
    },
    addressItemView: {
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      padding: 16,
      marginBottom: 12,
      borderRadius: 20,
    },
    addressItemInner: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    addressText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
    },
    walletIcon: {},
    centerInfo: {
      flexDirection: 'column',
      flexShrink: 1,
      width: '100%',
      // ...makeDebugBorder('blue')
    },
    nameAndAdderss: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      // ...makeDebugBorder('yellow'),
    },
    addressAliasName: {
      flexShrink: 1,
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontStyle: 'normal',
      fontWeight: '500',
      color: ctx.colors2024['neutral-foot'],
    },
    balanceText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    bottomArea: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      width: '100%',
      marginTop: 6,
    },
    divider: {
      height: 12,
      maxHeight: '100%',
      width: 1,
      backgroundColor: ctx.colors2024['brand-light-1'],
      marginHorizontal: 8,
    },
    addressUsdValue: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 20,
      color: ctx.colors2024['neutral-title-1'],
    },
    addressUsdValueCurrent: {
      // color: ctx.colors2024['brand-default'],
      color: ctx.colors2024['neutral-title-1'],
      fontWeight: '700',
    },
    rightArea: {
      justifyContent: 'center',
      alignItems: 'center',
      // height: '100%',
    },
    tag: {
      paddingVertical: 1,
      paddingHorizontal: 4,
      borderRadius: 4,
      backgroundColor: colors2024['brand-light-1'],
    },
    tagText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 16,
      color: ctx.colors2024['brand-default'],
    },
  };
});
