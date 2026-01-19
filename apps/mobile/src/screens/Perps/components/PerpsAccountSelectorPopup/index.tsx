import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useAccountSelectorList } from '@/components2024/AccountSelector/useAccountSelectorList';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { apisPerps } from '@/core/apis';
import { Account } from '@/core/services/preference';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ClearinghouseState } from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn, useRequest } from 'ahooks';
import { keyBy, sortBy, uniqBy } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import { PerpsAccountSelectorItem } from './PerpsAccountSelectorItem';
import { getClearinghouseStateByMap } from '@/hooks/perps/usePerpsStore';

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

  const { data: lastUsedAccount, runAsync: runGetLastUsedAccount } = useRequest(
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

  const sdk = apisPerps.getPerpsSDK();

  const { data: _data, runAsync: runFetchPerpsInfo } = useRequest(
    async () => {
      const list = uniqBy(myAddresses, i => i.address.toLowerCase());
      const res = await Promise.all(
        list.slice(0, 10).map(item => {
          try {
            // const info = await sdk.info.getClearingHouseState(item.address);
            return {
              address: item.address,
              info: getClearinghouseStateByMap(item.address),
            };
          } catch (e) {
            return {
              address: item.address,
              info: null,
            };
          }
        }),
      );

      const resDict = keyBy(res, item => item.address.toLowerCase());

      const dict = {
        active: [],
        inactive: [],
      } as Record<
        string,
        { info?: ClearinghouseState; account: KeyringAccountWithAlias }[]
      >;
      myAddresses.forEach((account, index) => {
        const item = resDict[account.address.toLowerCase()];
        if (
          item?.info &&
          (item.info.assetPositions.length ||
            +item.info.marginSummary > 0 ||
            +item.info.withdrawable > 0)
        ) {
          dict.active?.push({
            info: {
              ...item.info,
            },
            account: account,
          });
        } else {
          dict.inactive?.push({ account: account });
        }
      });

      dict.active = sortBy(
        dict.active,
        item => -(item.info?.assetPositions?.length || 0),
        item => -Number(item.info?.withdrawable || 0),
      );

      return dict;
    },
    {
      manual: true,
      cacheKey: `PerpsAccountSelectorPopup-fetchPerpsInfo-${myAddresses
        .map(i => i.address)
        .join('-')}`,
      // cacheTime: 10 * 1000,
      staleTime: 10 * 1000,
    },
  );

  const data = useMemo(() => {
    if (!_data) {
      return {
        active: [],
        inactive: myAddresses.map(item => ({ account: item })),
      };
    }
    return _data;
  }, [_data, myAddresses]);

  const [tmpSelectAccount, setTmpSelectAccount] = useState<Account | null>(
    value || null,
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
      setTmpSelectAccount(value || null);
      cancelSelect();
    } else {
      runGetLastUsedAccount();
    }
  }, [cancelSelect, runGetLastUsedAccount, value, visible]);

  useEffect(() => {
    if (visible) {
      runFetchPerpsInfo();
    }
  }, [runFetchPerpsInfo, visible]);

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
          {data?.active.length ? (
            <View style={styles.section}>
              {/* <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t('page.perps.PerpsAccountSelectorPopup.activatedAddress')}
                </Text>
                <Text style={styles.sectionTitle}>
                  {t('page.perps.PerpsAccountSelectorPopup.hyperliquidBalance')}
                </Text>
              </View> */}
              {data?.active?.map(item => {
                return (
                  <PerpsAccountSelectorItem
                    key={
                      item.account.address +
                      item.account.type +
                      item.account.brandName
                    }
                    account={item.account}
                    tmpSelectAccount={
                      tmpSelectAccount as KeyringAccountWithAlias
                    }
                    info={item.info}
                    lastUsedAccount={lastUsedAccount as KeyringAccountWithAlias}
                    loading={loading}
                    onPress={handleSelect}
                    currentAccount={value as KeyringAccountWithAlias}
                  />
                );
              })}
            </View>
          ) : null}
          {data?.inactive.length ? (
            <View style={styles.section}>
              {/* {data.active.length ? (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {t(
                      'page.perps.PerpsAccountSelectorPopup.notActivatedAddress',
                    )}
                  </Text>
                </View>
              ) : null} */}
              {data?.inactive?.map(item => {
                return (
                  <PerpsAccountSelectorItem
                    key={
                      item.account.address +
                      item.account.type +
                      item.account.brandName
                    }
                    account={item.account}
                    tmpSelectAccount={
                      tmpSelectAccount as KeyringAccountWithAlias
                    }
                    info={item.info}
                    lastUsedAccount={lastUsedAccount as KeyringAccountWithAlias}
                    loading={loading}
                    onPress={handleSelect}
                    currentAccount={value as KeyringAccountWithAlias}
                  />
                );
              })}
            </View>
          ) : null}
          {/* {myAddresses?.map(item => {
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
          })} */}
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getModalStyle = createGetStyles2024(ctx => {
  const { colors2024, isLight } = ctx;
  return {
    handleStyle: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      paddingTop: 10,
      height: 36,
    },
    container: {
      // height: '100%',
      minHeight: 364,
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
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
    section: {
      // marginBottom: 12,
    },
    sectionHeader: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 6,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});
