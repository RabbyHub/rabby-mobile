import { AssetAvatar } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useFallbackAccount } from '@/hooks/account';
import { useTokens } from '@/hooks/chainAndToken/useToken';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

export const PerpsSelectTokenPopup: React.FC<{
  onClose?(): void;
  visible?: boolean;
}> = ({ onClose, visible }) => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const address = '0x341a1fbd51825e5a107db54ccb3166deba145479';

  const { tokens, updateData } = useTokens(address, false, 0, undefined, true);

  useEffect(() => {
    if (visible) {
      updateData();
    }
  }, [updateData, visible]);

  const renderItem = useMemoizedFn(
    ({ item }: { item: AbstractPortfolioToken }) => {
      return (
        <TouchableOpacity
          style={[styles.tokenListItem]}
          onPress={() => {
            // if (!disabled) {
            //   onChange(item);
            //   onClose();
            // }
          }}>
          <View style={styles.box}>
            <AssetAvatar
              size={40}
              chain={item.chain}
              logo={item.logo_url}
              chainSize={16}
            />
            <Text
              style={StyleSheet.flatten([
                {
                  marginLeft: 16,
                },
                styles.text,
              ])}>
              {getTokenSymbol(item)}
            </Text>
          </View>
          <Text style={styles.text}>
            {formatUsdValue(item.amount * item.price || 0)}
          </Text>
        </TouchableOpacity>
      );
    },
  );

  const modalRef = useRef<AppBottomSheetModal>(null);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

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
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      onDismiss={onClose}
      // enableDynamicSizing
      snapPoints={[Dimensions.get('window').height - 200]}
      // maxDynamicContentSize={maxHeight}
    >
      <AutoLockView style={styles.container}>
        <Text style={styles.title}>Select Token to Deposit</Text>
        <BottomSheetFlatList
          keyboardShouldPersistTaps="handled"
          // onScrollBeginDrag={() => Keyboard.dismiss()}
          // sections={sortedList}
          data={tokens}
          style={styles.flatList}
          // ListHeaderComponent={ListHeader}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          keyExtractor={item => item.id + item.chain}
        />
        {/* <TokenSelector
        onClose={() => setTokenListVisible(false)}
        cost={depositAmount}
        onChange={setToken}
        address={depositAccount.address}
      /> */}
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors, isLight, colors2024 }) => ({
  container: {
    width: '100%',
    // flex: 1
    height: '100%',
    position: 'relative',
    paddingBottom: 20,
  },
  popup: {
    margin: 0,
    // paddingBottom: 156,
    width: '100%',
    flex: 1,
  },
  handleStyle: {
    backgroundColor: 'transparent',
    paddingTop: 10,
    height: 36,
  },
  containerHorizontal: {
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    marginTop: 12,
    marginBottom: 18,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    marginBottom: 10,
  },
  amountSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    height: 52,
  },
  amountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 8,
    height: 60,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-2'],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedAmountButton: {
    backgroundColor: colors['blue-light1'],
    borderColor: colors['blue-default'],
  },
  amountText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  input: {
    flex: 1,
    height: 60,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 10,
    color: colors2024['neutral-body'],
  },
  tokenLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'left',
    width: '100%',
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors['neutral-card2'],
    borderRadius: 30,
    width: '100%',
    height: 62,
    paddingHorizontal: 20,
  },
  flatList: {
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  tokenListItem: {
    paddingVertical: 14,
    flex: 1,
    width: '100%',
    height: 74,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingLeft: 12,
    paddingRight: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 16,
  },
  tokenContent: { flexDirection: 'row', alignItems: 'center' },
  tokenSymbol: {
    marginLeft: 12,
    color: colors['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  tokenPlaceholder: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  confirmButton: {
    width: '100%',
    height: 52,
    marginBottom: 35,
  },
  btnContainer: {
    backgroundColor: colors2024['neutral-bg-1'],
    // marginTop: 34,
    width: '100%',
    bottom: 0,
    height: 126,
    position: 'absolute',
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'flex-end',
    // flex: 1,
  },

  box: { flexDirection: 'row', alignItems: 'center' },
  text: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },

  errorTips: {
    textAlign: 'left',
    width: '100%',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 20,
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 12,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 22,
  },

  insufficientWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientDivider: {
    position: 'absolute',
    top: 18,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: colors2024['red-light-2'],
  },

  insufficientTip: {
    color: colors2024['red-default'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    paddingHorizontal: 8,
  },

  tokenInsufficientWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },

  tokenInsufficientDivider: {
    position: 'absolute',
    top: 9,
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },

  tokenInsufficientTip: {
    color: colors2024['neutral-info'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    paddingHorizontal: 8,
  },

  searchInputContainer: {
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    paddingHorizontal: 13,
    borderColor: 'transparent',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchIconWrapperStyle: {
    paddingLeft: 0,
  },
  inputStyle: {
    fontFamily: 'SF Pro Rounded',
    lineHeight: 22,
    fontSize: 17,
    color: colors2024['neutral-title-1'],
  },

  accountItem: {
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 96,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    paddingHorizontal: 24,
  },

  pinnedWrapper: {
    flexShrink: 0,
    marginLeft: 4,
    borderRadius: 6,
    width: 33,
    height: 20,
    flexWrap: 'nowrap',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['brand-light-1'],
  },
  pinText: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },
  walletName: {
    color: colors2024['neutral-title-1'],

    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 3,
    backgroundColor: colors2024['orange-light-1'],
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 16,
  },
  divider: {
    height: 8,
  },
}));
