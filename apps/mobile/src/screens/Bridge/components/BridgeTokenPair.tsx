import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BridgeTokenPair as BridgeTokenPairType,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import { useSheetModal } from '@/hooks/useSheetModal';
import { AppBottomSheetModal, AssetAvatar, Tip } from '@/components';
import { ModalLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { TokenPairLoading } from './loading';
import {
  ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { getTokenSymbol } from '@/utils/token';
import { formatUsdValue } from '@/utils/number';
import RcArrowDown from '@/assets/icons/bridge/down.svg';
import { RcIconEmptyCC } from '@/assets/icons/gnosis';
import useAsync from 'react-use/lib/useAsync';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

const getStyles = createGetStyles(colors => {
  return {
    wrapper: {
      height: 60,
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 4,
      paddingHorizontal: 12,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title1'],
    },
    title: {
      textAlign: 'center',
      fontSize: 20,
      color: colors['neutral-title-1'],
      fontWeight: '500',
      marginTop: 20,
      marginBottom: 20,
    },
    pair: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    token: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title1'],
    },
    placeholder: {
      color: colors['neutral-title1'],
      fontSize: 18,
      fontWeight: '500',
      flexShrink: 1,
    },
    tokenSymbol: {
      maxWidth: 100,
      color: colors['neutral-title1'],
      fontSize: 18,
      fontWeight: '500',
    },
    arrow: {
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-foot'],
    },
    down: {
      marginLeft: 'auto',
      minWidth: 24,
      minHeight: 24,
    },
    sheet: {
      backgroundColor: colors['neutral-bg-1'],
    },
    container: {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
    },

    header: {
      marginHorizontal: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      borderBottomWidth: 0.5,
      borderBottomColor: colors['neutral-line'],
      borderStyle: 'solid',
    },
    text: {
      fontSize: 14,
      color: colors['neutral-foot'],
    },
    scrollView: {
      flexDirection: 'column',
      flexGrow: 1,
    },
    scrollViewInner: {
      paddingBottom: 20,
    },
    tokenContainer: {
      paddingHorizontal: 20,
      height: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: 4,
      borderStyle: 'solid',
      hover: {
        borderColor: colors['blue-default'],
      },
    },
    disabled: {
      opacity: 0.4,
    },
    tokenInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tokenText: {
      marginLeft: 12,
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title1'],
    },
    toArrow: {
      marginHorizontal: 6,
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-foot'], // 'text-r-neutral-foot'
    },
    usdValue: {
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-title1'],
    },
    emptyContainer: {
      height: '100%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    image: {
      width: 40,
      height: 40,
    },
    emptyText: {
      fontSize: 14,
      color: colors['neutral-foot'], // 'text-r-neutral-foot'
    },
  };
});

const TokenPairItem = (props: {
  tokenPair: BridgeTokenPairType;
  onSelectTokenPair: TokenPairDrawerProps['onSelectTokenPair'];
}) => {
  const { tokenPair, onSelectTokenPair } = props;
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [tipVisible, setTipVisible] = React.useState(false);

  const handleSelectTokenPair = useCallback(() => {
    if (tokenPair.from_token_amount) {
      onSelectTokenPair({
        from: {
          ...tokenPair.from_token,
          amount: tokenPair.from_token_amount,
          raw_amount_hex_str: tokenPair.from_token_raw_amount_hex_str,
        },
        to: tokenPair.to_token,
      });
    } else {
      setTipVisible(true);
    }
  }, [tokenPair, onSelectTokenPair]);

  return (
    <Tip
      isVisible={tipVisible}
      onClose={() => setTipVisible(false)}
      content={
        <Text
          style={{
            padding: 20,
            fontSize: 13,
            color: colors['neutral-title-2'],
          }}>
          {t('page.gasTopUp.InsufficientBalanceTips')}
        </Text>
      }>
      <TouchableOpacity
        key={tokenPair.from_token_raw_amount_hex_str}
        onPress={handleSelectTokenPair}
        style={StyleSheet.flatten([
          styles.tokenContainer,
          !tokenPair.from_token_amount && styles.disabled,
        ])}>
        <View style={styles.tokenInfo}>
          <AssetAvatar
            size={32}
            chain={tokenPair.from_token.chain}
            chainSize={14}
            logo={tokenPair.from_token.logo_url}
          />
          <Text style={styles.tokenText}>
            {getTokenSymbol(tokenPair.from_token)}
          </Text>
          <Text style={styles.toArrow}>→</Text>
          <Text style={styles.tokenText}>
            {getTokenSymbol(tokenPair.to_token)}
          </Text>
        </View>
        <Text style={styles.usdValue}>
          {formatUsdValue(
            new BigNumber(tokenPair.from_token_amount || '0')
              .times(tokenPair.from_token.price)
              .toString(),
          )}
        </Text>
      </TouchableOpacity>
    </Tip>
  );
};

interface TokenPairDrawerProps {
  aggregatorIds: string[];
  chain: CHAINS_ENUM;
  visible: boolean;
  onSelectTokenPair: (value: TokenPair) => void;
  onCancel(): void;
}

const TokenPairDrawer = (props: TokenPairDrawerProps) => {
  const { visible, onSelectTokenPair, onCancel } = props;
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { sheetModalRef: tokenSelectorModal, toggleShowSheetModal } =
    useSheetModal();

  const { currentAccount } = useCurrentAccount();

  useEffect(() => {
    toggleShowSheetModal(visible ? true : false);
  }, [toggleShowSheetModal, visible]);

  const { value, loading } = useAsync(async () => {
    if (currentAccount && props.visible) {
      return openapi.getBridgePairList({
        aggregator_ids: props.aggregatorIds,
        to_chain_id: CHAINS[props.chain].serverId,
        user_addr: currentAccount.address,
      });
    }
  }, [props.visible, props.chain, props.aggregatorIds]);

  const Loading = useCallback(() => {
    if (!loading) {
      return null;
    }
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <TokenPairLoading key={i} />
        ))}
      </>
    );
  }, [loading]);

  const Empty = useCallback(
    () => (
      <>
        {!loading && !value?.length && (
          <View style={styles.container}>
            <RcIconEmptyCC
              color={colors['neutral-foot']}
              style={styles.image}
            />
            <Text style={styles.text}>
              {t('page.bridge.tokenPairDrawer.noData')}
            </Text>
          </View>
        )}
      </>
    ),
    [
      loading,
      value?.length,
      styles.container,
      styles.image,
      styles.text,
      colors,
      t,
    ],
  );
  return (
    <AppBottomSheetModal
      ref={tokenSelectorModal}
      snapPoints={[ModalLayouts.defaultHeightPercentText]}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      backgroundStyle={styles.sheet}
      enableDismissOnClose={true}
      bottomInset={1}
      onDismiss={onCancel}>
      <BottomSheetView style={styles.container}>
        <BottomSheetHandlableView>
          <Text style={styles.title}>
            {t('page.bridge.tokenPairDrawer.title')}
          </Text>
          <View style={styles.header}>
            <Text style={styles.text}>
              {t('page.bridge.tokenPairDrawer.tokenPair')}
            </Text>
            <Text style={styles.text}>
              {t('page.bridge.tokenPairDrawer.balance')}
            </Text>
          </View>
        </BottomSheetHandlableView>

        <BottomSheetFlatList
          keyboardShouldPersistTaps="handled"
          keyExtractor={item =>
            `${item.from_token.chain}-${item.from_token.id}-${item.to_token.id}`
          }
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewInner}
          data={value}
          extraData={loading}
          renderItem={useCallback(
            ({ item: tokenPair }: ListRenderItemInfo<BridgeTokenPairType>) => {
              if (loading) {
                return null;
              }
              return (
                <TokenPairItem
                  tokenPair={tokenPair}
                  onSelectTokenPair={onSelectTokenPair}
                />
              );
            },
            [loading, onSelectTokenPair],
          )}
          ListHeaderComponent={Loading}
          ListEmptyComponent={Empty}
        />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

type TokenPair = {
  from: TokenItem;
  to: TokenItem;
};

export const BridgeTokenPair = (props: {
  aggregatorIds: string[];
  chain: CHAINS_ENUM;
  value?: TokenPair;
  onChange: (value: TokenPair) => void;
}) => {
  const { value, onChange } = props;

  const { t } = useTranslation();

  const [visible, setVisible] = React.useState(false);

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const onSelectTokenPair = React.useCallback(
    (params: TokenPair) => {
      onChange(params);
      setVisible(false);
    },
    [onChange],
  );
  return (
    <>
      <TouchableOpacity style={styles.wrapper} onPress={() => setVisible(true)}>
        {!value ? (
          <Text style={styles.placeholder}>
            {t('page.bridge.tokenPairPlaceholder')}
          </Text>
        ) : (
          <View style={styles.pair}>
            <View style={styles.token}>
              <AssetAvatar
                size={32}
                chainSize={16}
                chain={value?.from.chain}
                logo={value?.from.logo_url}
              />
              <Text
                style={styles.tokenSymbol}
                numberOfLines={1}
                ellipsizeMode="tail">
                {getTokenSymbol(value?.from)}
              </Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.token}>
              <AssetAvatar
                size={32}
                chainSize={16}
                chain={value?.to.chain}
                logo={value?.to.logo_url}
              />
              <Text
                style={styles.tokenSymbol}
                numberOfLines={1}
                ellipsizeMode="tail">
                {getTokenSymbol(value?.to)}
              </Text>
            </View>
          </View>
        )}
        <RcArrowDown style={styles.down} />
      </TouchableOpacity>

      <TokenPairDrawer
        onSelectTokenPair={onSelectTokenPair}
        aggregatorIds={props.aggregatorIds}
        chain={props.chain}
        visible={visible}
        onCancel={() => setVisible(false)}
      />
    </>
  );
};
