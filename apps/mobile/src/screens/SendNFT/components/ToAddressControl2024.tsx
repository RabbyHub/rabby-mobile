import React, { useLayoutEffect, useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  Pressable,
  Image,
} from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useFindAddressByWhitelist } from '@/screens/Send/hooks/useWhiteListAddress';
import { SheetModalSelectAccountSend } from '@/components/AccountSelectModalTx/SelectAccountSheetModal';

import { AddressItem as InnerAddressItem } from '@/components2024/AddressItem/AddressItem';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { RcIconLockCC, RcIconSwitchCC } from '@/assets/icons/send';
import { RootNames } from '@/constant/layout';
import { useWhitelist } from '@/hooks/whitelist';
import { AddrDescResponse, Cex } from '@rabby-wallet/rabby-api/dist/types';
import { AddressItemShadowView } from '@/screens/Address/components/AddressItemShadowView';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { getCexWithLocalCache } from '@/databases/hooks/cex';
import { useAlias2 } from '@/hooks/alias';
import { default as RcIconUnknownAddressAvatarCC } from '@/screens/Send/icons/unknown-address-avatar-cc.svg';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import { useSendNFTInternalContext } from '../hooks/useSendNFT';
import { RcIconTipRightCC } from '@/screens/Send/icons';
import { makeAccountObject } from '@/utils/account';

export const ToAccountEntry = ({
  account,
  isSelectingAccount = false,
  onPress,
  style,
  addrDesc,
  inWhiteList,
}: {
  account: KeyringAccountWithAlias;
  isSelectingAccount: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  addrDesc?: AddrDescResponse['desc'] | null;
  inWhiteList?: boolean;
  disableMenu?: boolean;
  isMyImported?: boolean;
  hideBalance?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getToItemStyles });
  const { t } = useTranslation();
  const [cacheCexDes, setCacheCexDes] = useState<Cex | null>(null);
  const cexDes = useMemo(
    () => addrDesc?.cex || cacheCexDes,
    [addrDesc?.cex, cacheCexDes],
  );
  const { adderssAlias } = useAlias2(account.address, { autoFetch: true });
  const { formatName } = useMemo(() => {
    const ellipisName = ellipsisAddress(account.address);
    const name = adderssAlias || account.aliasName || ellipisName;
    return {
      formatName: name,
    };
  }, [account.address, account.aliasName, adderssAlias]);

  useLayoutEffect(() => {
    if (cexDes) return;

    setCacheCexDes(null);
    getCexWithLocalCache(account.address, false, true).then(res => {
      if (res?.id) {
        setCacheCexDes(res);
      }
    });
  }, [cexDes, account.address]);

  const isEmptyAddress = !account.address;

  return (
    <AddressItemShadowView
      style={[
        styles.shadowView,
        isEmptyAddress && styles.emptyAddrShadowView,
        isEmptyAddress && styles.emptyBg,
      ]}
      disableShadow={isEmptyAddress}>
      <View style={styles.root}>
        <Card
          style={StyleSheet.flatten([
            styles.card,
            isEmptyAddress && styles.emptyBg,
            style,
          ])}
          onPress={evt => {
            evt.stopPropagation();
            onPress();
          }}>
          <InnerAddressItem style={styles.rootItem} account={account}>
            {({ WalletIcon }) => (
              <View style={styles.item}>
                {isEmptyAddress ? (
                  <View
                    style={[styles.iconWrapper, styles.iconWrapperNoAddress]}>
                    <RcIconUnknownAddressAvatarCC
                      style={[styles.walletIcon, { width: 13, height: 13 }]}
                      color={colors2024['neutral-info']}
                      width={13}
                      height={13}
                    />
                  </View>
                ) : (
                  <View style={styles.iconWrapper}>
                    {cexDes?.is_deposit && cexDes?.logo_url ? (
                      <Image
                        source={{ uri: cexDes?.logo_url }}
                        style={styles.walletIcon}
                        width={46}
                        height={46}
                      />
                    ) : (
                      <WalletIcon
                        style={styles.walletIcon}
                        width={46}
                        height={46}
                      />
                    )}
                    {inWhiteList && (
                      <RcIconLockCC
                        style={styles.lockIcon}
                        color={colors2024['green-default']}
                        surroundColor={colors2024['neutral-bg-1']}
                        width={22}
                        height={22}
                      />
                    )}
                  </View>
                )}
                <View style={styles.itemInfo}>
                  {isEmptyAddress ? (
                    <View>
                      <Text style={styles.selectPlaceholder}>
                        {t('page.sendToken.sectionTo.selectPlaceholder')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.itemNameNoBalance}>
                      <Text
                        style={[
                          styles.itemNameText,
                          styles.hideBalanceNameText,
                        ]}
                        ellipsizeMode="tail"
                        numberOfLines={1}>
                        {formatName}
                      </Text>
                      <Pressable
                        onPress={() => {
                          const modalId = createGlobalBottomSheetModal2024({
                            name: MODAL_NAMES.ADDRESS_HIGHT_DESC,
                            address: account.address,
                            bottomSheetModalProps: {
                              enableContentPanningGesture: true,
                              enablePanDownToClose: true,
                              enableDismissOnClose: true,
                            },
                            nextButtonProps: {
                              title: (
                                <Text style={styles.modalNextButtonText}>
                                  {t('global.ok')}
                                </Text>
                              ),
                              titleStyle: StyleSheet.flatten([
                                styles.modalNextButtonText,
                              ]),
                              onPress: () => {
                                removeGlobalBottomSheetModal2024(modalId);
                              },
                            },
                          });
                        }}
                        hitSlop={10}>
                        <View style={styles.underlineContainer}>
                          <Text style={styles.hideBalanceAddress}>
                            {ellipsisAddress(account.address)}
                          </Text>
                          <View style={styles.customDashedLine}>
                            {Array.from({ length: 40 }, (_, index) => (
                              <View
                                key={index}
                                style={[
                                  styles.dashSegment,
                                  { marginRight: index % 2 === 0 ? 3 : 0 },
                                ]}
                              />
                            ))}
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            )}
          </InnerAddressItem>
          <View style={styles.arrow} hitSlop={10}>
            {isEmptyAddress ? (
              <CaretArrowIconCC
                dir={!isSelectingAccount ? 'right' : 'down'}
                style={[{ marginLeft: 'auto' }]}
                width={26}
                height={26}
                bgColor={colors2024['neutral-line']}
                lineColor={colors2024['neutral-title-1']}
              />
            ) : (
              <RcIconSwitchCC
                fillColor={colors2024['neutral-bg-2']}
                strokeColor={colors2024['neutral-body']}
                width={24}
                height={24}
              />
            )}
          </View>
        </Card>
      </View>
    </AddressItemShadowView>
  );
};

const getToItemStyles = createGetStyles2024(({ colors2024 }) => ({
  shadowView: {
    borderRadius: 20,
    // backgroundColor: colors2024['neutral-bg-1'],
  },
  emptyAddrShadowView: {
    borderWidth: 0,
  },
  root: {
    // borderRadius: 20,
    overflow: 'hidden',
    // backgroundColor: colors2024['neutral-bg-2'],
  },
  rootPressing: {
    borderColor: colors2024['brand-light-2'],
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 0,
    // borderColor: colors2024['neutral-line'],
    borderRadius: 20,
    flex: 1,
    flexGrow: 1,
    backgroundColor: colors2024['neutral-bg-1'],
    padding: 16,
    paddingRight: 24,
  },
  emptyBg: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  rootItem: {
    flexDirection: 'row',
    flex: 1,
    flexGrow: 1,
    marginRight: 12,
  },
  item: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 46,
    height: 46,
    position: 'relative',
  },
  iconWrapperNoAddress: {
    width: 24,
    height: 24,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    transform: [{ translateX: 5 }, { translateY: 2 }],
  },
  itemInfo: {
    gap: 4,
    flexGrow: 1,
    flex: 1,
  },
  itemNameText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  hideBalanceNameText: {
    maxWidth: '100%',
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  itemNameTextHasPinned: {
    paddingRight: 52,
  },
  itemNamePinned: {
    marginLeft: -52,
  },
  itemBalanceText: {
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
  },
  itemName: {
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemNameNoBalance: {
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-start',
  },
  selectPlaceholder: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
  },
  hideBalanceAddress: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  underlineContainer: {
    position: 'relative',
    width: '100%',
    paddingBottom: 0,
    overflow: 'hidden',
  },
  customDashedLine: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashSegment: {
    width: 3,
    height: 1,
    backgroundColor: colors2024['neutral-secondary'],
    marginRight: 3,
  },
  arrow: {
    width: 30,
    height: 30,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressing: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 16,
  },
  arrowPressing: {
    backgroundColor: colors2024['brand-light-1'],
  },
  walletIcon: {
    borderRadius: 12,
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    color: colors2024['neutral-InvertHighlight'],
    backgroundColor: colors2024['brand-default'],
  },
}));

export default function ToAddressControl2024({
  style,
  // brandName,
  addrDesc,
}: React.PropsWithChildren<
  RNViewProps & {
    // brandName?: string;
    addrDesc?: AddrDescResponse['desc'] | null;
  }
>) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { isAddrOnWhitelist } = useWhitelist();
  const { findAccountWithoutBalance } = useFindAddressByWhitelist();
  const {
    formValues,
    computed: { toAddressPositiveTips, toAccount },
    callbacks: { handleFieldChange },
  } = useSendNFTInternalContext();

  const { t } = useTranslation();

  const [isSelectingAccount, setIsSelectingAccount] = useState(false);

  if (!toAccount) return null;

  return (
    <View style={[styles.control, style]}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>{t('page.sendToken.To')}</Text>
        {!!toAddressPositiveTips?.hasPositiveTips && (
          <View style={styles.positiveTipsInfo}>
            <RcIconTipRightCC
              width={18}
              height={18}
              color={colors2024['green-default']}
            />
            <Text style={styles.positiveTipsText}>
              {toAddressPositiveTips?.inWhitelist ? (
                <Text>
                  {t(
                    'page.sendToken.sectionTo.positiveTips.whitelistedAddress',
                  )}
                </Text>
              ) : toAddressPositiveTips?.isMyImported ? (
                <Text>
                  {t('page.sendToken.sectionTo.positiveTips.yourOwnAddress')}
                </Text>
              ) : toAddressPositiveTips.isRecentlySend ? (
                t('page.sendToken.sectionTo.positiveTips.sentRecently')
              ) : null}
            </Text>
          </View>
        )}
      </View>
      <ToAccountEntry
        isSelectingAccount={isSelectingAccount}
        onPress={() => setIsSelectingAccount(true)}
        account={toAccount}
        addrDesc={addrDesc}
        inWhiteList={isAddrOnWhitelist(toAccount.address)}
      />
      <SheetModalSelectAccountSend
        visible={isSelectingAccount}
        onVisibleChange={visible => {
          setIsSelectingAccount(!!visible);
        }}
        onSelectAccount={account => {
          // setCurrentAccount(account);
          handleFieldChange('to', account?.address || '');
          setIsSelectingAccount(false);
        }}
        type="SendTo"
      />
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    control: {
      width: '100%',
      marginBottom: 24,
      gap: 12,
      marginTop: 24,
    },

    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },

    positiveTipsInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    positiveTipsText: {
      marginLeft: 4,
      color: colors2024['green-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 18,
    },
  };
});
