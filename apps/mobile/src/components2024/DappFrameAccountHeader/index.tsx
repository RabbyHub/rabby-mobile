import PngPolymarket from '@/assets2024/icons/prediction/polymarket.png';
import PngHyperliquid from '@/assets2024/icons/perps/hyperliquid.png';
import PngAster from '@/assets2024/icons/perps/aster.png';
import PngLighter from '@/assets2024/icons/perps/lighter.png';
import PngAave from '@/assets2024/icons/lending/aave.png';
import PngSpark from '@/assets2024/icons/lending/spark.png';
import PngVenus from '@/assets2024/icons/lending/venus.png';
import { Account } from '@/core/services/preference';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  Image,
  ImageSourcePropType,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { apiContact } from '@/core/apis';
import React from 'react';
import { ellipsisAddress } from '@/utils/address';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import RcCaretDownSmallCC from '@/assets2024/icons/common/caret-down-small-cc.svg';
import { HeaderBackPressable, useRabbyAppNavigation } from '@/hooks/navigation';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import { KeyringAccountWithAlias } from '@/core/apis/account';

export type DappSelectItem = {
  id: string;
  name: string;
  icon: ImageSourcePropType;
  url?: string;
  description?: string;
  rightText?: string;
  onPress?: (item: DappSelectItem) => void;
  themeColor: string;
};

const PREDICTION: DappSelectItem[] = [
  {
    id: 'polymarket',
    name: 'Polymarket',
    icon: PngPolymarket,
    url: 'https://polymarket.com/',
    themeColor: 'rgba(22, 82, 240, 0.06)',
  },
];

const LENDING: DappSelectItem[] = [
  {
    id: 'aave',
    name: 'Aave',
    icon: PngAave,
    url: 'https://app.aave.com',
    themeColor: 'rgba(147, 145, 247, 0.10)',
  },
  {
    id: 'venus',
    name: 'Venus',
    icon: PngVenus,
    url: 'https://app.venus.io',
    themeColor: 'rgba(58, 121, 253, 0.08)',
  },
  {
    id: 'spark',
    name: 'Spark',
    icon: PngSpark,
    url: 'https://app.spark.fi/',
    themeColor: 'rgba(252, 105, 137, 0.08)',
  },
];

const PERPS: DappSelectItem[] = [
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    icon: PngHyperliquid,
    url: 'https://app.hyperliquid.xyz/',
    themeColor: 'rgba(175, 249, 229, 0.15)',
  },
  {
    id: 'aster',
    name: 'Aster',
    icon: PngAster,
    url: 'https://www.asterdex.com/trade/pro/futures/BTCUSDT',
    themeColor: 'rgba(247, 212, 172, 0.16)',
  },
  {
    id: 'lighter',
    name: 'Lighter',
    icon: PngLighter,
    url: 'https://app.lighter.xyz/trade/LIT_USDC',
    themeColor: 'rgba(11, 11, 11, 0.06)',
  },
];

export const INNER_DAPP_LIST = {
  PREDICTION,
  LENDING,
  PERPS,
} as const;

const AccountItem = ({
  account,
  isShowAccountList,
  onPress,
  onCloseAccountList,
  onSelectAccount,
  disablePopup,
}: {
  account?: Account;
  isShowAccountList?: boolean;
  onPress?: () => void;
  onCloseAccountList?: () => void;
  onSelectAccount?: (account: Account) => void;
  disablePopup?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const alias = React.useMemo(() => {
    if (!account?.address) {
      return;
    }
    return apiContact.getAliasName(account?.address);
  }, [account?.address]);

  if (!account) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          onPress?.();
        }}
        disabled={!account}>
        <View style={styles.container}>
          {account ? (
            <View style={styles.addressContainer}>
              <WalletIcon
                style={styles.walletIcon}
                width={18}
                height={18}
                type={account.brandName}
                address={account.address}
              />
              <Text style={styles.address}>
                {alias || ellipsisAddress(account?.address)}
              </Text>
              <CaretArrowIconCC
                dir="down"
                style={[isShowAccountList ? styles.reverseCaret : null]}
                width={18}
                height={18}
                bgColor={colors2024['neutral-bg-5']}
                lineColor={colors2024['neutral-title-1']}
              />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      {!disablePopup ? (
        <AccountSelectorPopup
          visible={!!isShowAccountList}
          onClose={onCloseAccountList}
          value={account}
          onChange={nextAccount => {
            onSelectAccount?.(nextAccount);
            onCloseAccountList?.();
          }}
        />
      ) : null}
    </>
  );
};

const DappSelect = (props: {
  activeId: string;
  list: DappSelectItem[];
  title?: string;
  onSelect?: (item: DappSelectItem) => void;
}) => {
  const { activeId, list, title, onSelect } = props;
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { height } = useWindowDimensions();
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const [visible, setVisible] = React.useState(false);
  const maxHeight = React.useMemo(() => height - 200, [height]);

  const activeItem = list.find(item => item.id === activeId);
  const sheetTitle = title ?? 'Select Dapp';

  React.useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      return;
    }
    modalRef.current?.dismiss();
  }, [visible]);

  const handleOpen = React.useCallback(() => {
    if (list.length > 1) {
      setVisible(true);
    }
  }, [list.length]);

  const handleDismiss = React.useCallback(() => {
    setVisible(false);
  }, []);

  const handleSelect = React.useCallback(
    (item: DappSelectItem) => {
      item.onPress?.(item);
      onSelect?.(item);
      setVisible(false);
    },
    [onSelect],
  );

  if (!activeItem) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.leftGroup}
        onPress={handleOpen}
        disabled={list?.length < 2}>
        <View
          style={[
            styles.marketPill,
            { backgroundColor: activeItem.themeColor },
          ]}>
          <Image style={styles.marketIcon} source={activeItem.icon} />
          <View style={styles.marketTextGroup}>
            <Text style={styles.marketText}>{activeItem.name}</Text>
            <RcCaretDownSmallCC
              style={styles.marketCaret}
              color={colors2024['neutral-info']}
            />
          </View>
        </View>
      </TouchableOpacity>
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: isLight ? 'bg0' : 'bg1',
        })}
        onDismiss={handleDismiss}
        enableDynamicSizing
        enableContentPanningGesture
        maxDynamicContentSize={maxHeight}>
        <BottomSheetScrollView>
          <AutoLockView style={styles.sheetContainer}>
            {sheetTitle ? (
              <Text style={styles.sheetTitle}>{sheetTitle}</Text>
            ) : null}
            <View style={styles.sheetList}>
              {list.map(item => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => handleSelect(item)}>
                  <View style={styles.sheetItem}>
                    <View style={styles.sheetItemLeft}>
                      <Image style={styles.sheetItemIcon} source={item.icon} />
                      <View style={styles.sheetItemTextGroup}>
                        <Text style={styles.sheetItemTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.description ? (
                          <Text
                            style={styles.sheetItemSubtitle}
                            numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {item.rightText ? (
                      <Text style={styles.sheetItemRight} numberOfLines={1}>
                        {item.rightText}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </AutoLockView>
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </>
  );
};

export const DappFrameAccountHeader = (props: {
  account?: Account | KeyringAccountWithAlias;
  onPressAccountList?: () => void;
  isShowAccountList?: boolean;
  title?: React.ReactNode;
  activeId: string;
  dAppList: DappSelectItem[];
  dappSelectTitle?: string;
  onSelectDapp?: (item: DappSelectItem) => void;
  onSelectAccount?: (account: Account) => void;
  rightAddon?: React.ReactNode;
  disableAccountPopup?: boolean;
}) => {
  const {
    account,
    onPressAccountList,
    isShowAccountList,
    title,
    activeId,
    dAppList,
    dappSelectTitle,
    onSelectDapp,
    onSelectAccount,
    rightAddon,
    disableAccountPopup,
  } = props;

  const navigation = useRabbyAppNavigation();
  const { styles } = useTheme2024({ getStyle });
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] =
    React.useState(false);
  const isAccountSelectorControlled = isShowAccountList !== undefined;
  const accountSelectorVisible = isAccountSelectorControlled
    ? !!isShowAccountList
    : isAccountSelectorOpen;

  const headerLeft = React.useCallback(() => {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <HeaderBackPressable />
        <DappSelect
          activeId={activeId}
          list={dAppList}
          title={dappSelectTitle}
          onSelect={onSelectDapp}
        />
      </View>
    );
  }, [activeId, dappSelectTitle, dAppList, onSelectDapp]);

  const handleOpenAccountSelector = React.useCallback(() => {
    if (!isAccountSelectorControlled) {
      setIsAccountSelectorOpen(true);
    }
    onPressAccountList?.();
  }, [isAccountSelectorControlled, onPressAccountList]);

  const handleCloseAccountSelector = React.useCallback(() => {
    if (!isAccountSelectorControlled) {
      setIsAccountSelectorOpen(false);
    }
  }, [isAccountSelectorControlled]);

  const handleSelectAccount = React.useCallback(
    (nextAccount: Account) => {
      onSelectAccount?.(nextAccount);
      if (!isAccountSelectorControlled) {
        setIsAccountSelectorOpen(false);
      }
    },
    [isAccountSelectorControlled, onSelectAccount],
  );

  const headerRight = React.useCallback(() => {
    const accountItem = (
      <AccountItem
        account={account}
        isShowAccountList={accountSelectorVisible}
        onPress={handleOpenAccountSelector}
        onCloseAccountList={handleCloseAccountSelector}
        onSelectAccount={handleSelectAccount}
        disablePopup={disableAccountPopup}
      />
    );

    if (!rightAddon) {
      return accountItem;
    }

    return (
      <View style={styles.headerRight}>
        {rightAddon}
        {accountItem}
      </View>
    );
  }, [
    account,
    accountSelectorVisible,
    disableAccountPopup,
    handleCloseAccountSelector,
    handleOpenAccountSelector,
    handleSelectAccount,
    rightAddon,
    styles.headerRight,
  ]);

  React.useEffect(() => {
    navigation.setOptions({
      headerLeft,
      headerTitle: () => title || <>{null}</>,
      headerRight,
    });
  }, [headerLeft, headerRight, navigation, title]);

  return null;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },

  addressContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletIcon: {},
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-foot'],
  },
  reverseCaret: {
    transform: [{ rotate: '180deg' }],
  },

  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 14,
    height: 14,
    transform: [{ rotate: '180deg' }],
  },
  marketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: 'rgba(22, 82, 240, 0.06)',
  },
  marketIcon: {
    width: 20,
    height: 20,
  },
  marketTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  marketText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  marketCaret: {
    width: 10,
    height: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetContainer: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 8,
  },
  sheetTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 20,
  },
  sheetList: {
    gap: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 15,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sheetItemIcon: {
    width: 46,
    height: 46,
  },
  sheetItemTextGroup: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  sheetItemTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  sheetItemSubtitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  sheetItemRight: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    marginLeft: 12,
  },
}));
