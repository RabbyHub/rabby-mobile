import React, { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { useAppState } from '@react-native-community/hooks';
import { useTranslation } from 'react-i18next';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Text } from '@/components/Typography';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Button } from '@/components2024/Button';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { openExternalUrl } from '@/core/utils/linking';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  RootNames,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useAccounts } from '@/hooks/account';
import { switchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { createGetStyles2024 } from '@/utils/styles';
import { findChain } from '@/utils/chain';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { formatIntlTimestamp } from '@/utils/time';
import { ellipsisAddress } from '@/utils/address';
import { naviPush, navigateDeprecated } from '@/utils/navigation';
import { openTxExternalUrl } from '@/utils/transaction';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { GetNestedScreenRouteProp } from '@/navigation-type';
import Right from '@/assets2024/icons/history/IconRightArrowCC.svg';
import Jump from '@/assets2024/icons/history/IconJumpCC.svg';
import { AddressItemInDetail } from '../Transaction/components/AddressItemInDetail';
import { ProjectItemInDetail } from '../Transaction/components/ProjectItemInDetail';
import { useBridgeRecord } from './hooks/useBridgeRecord';
import { useBridgeStatus } from './hooks/useBridgeStatus';
import {
  BridgeStatusCaption,
  BridgeStatusSteps,
} from './components/BridgeStatusUI';
import { openBridgeSupport } from './utils/support';
import { getBridgeHistoryTxId } from './utils/record';
import { useBridgeSourceMetadata } from './hooks/useBridgeSourceMetadata';

export function BridgeDetailScreen() {
  const { safeOffHeader } = useSafeSizes();
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'BridgeDetail'>
    >();
  // 详情失焦或应用退到后台时暂停同步和计时，返回前台后恢复。
  const focused = useIsFocused();
  const appState = useAppState();
  const active = focused && appState === 'active';
  const record = useBridgeRecord(route.params, active);
  const status = useBridgeStatus(record, active);
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const account = useMemo(
    () => accounts.find(item => isSameAddress(item.address, record.address)),
    [accounts, record.address],
  );
  const title = t(
    status.completed ? 'page.bridge.status.bridged' : 'page.bridge.title',
  );
  const headerTitle = useCallback(
    () => (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerAccount}>
          {account && (
            <WalletIcon
              type={account.type}
              address={record.address}
              style={styles.headerWallet}
            />
          )}
          <Text style={styles.headerAddress}>
            {ellipsisAddress(record.address)}
          </Text>
        </View>
      </View>
    ),
    [styles, title, account, record.address],
  );
  // 交易状态或账户变化时同步导航栏信息。
  useEffect(() => {
    setNavigationOptions({ headerTitle });
  }, [setNavigationOptions, headerTitle]);
  const sourceChain = findChain({ serverId: status.fromToken?.chain });
  const toChain = findChain({ serverId: status.toToken?.chain });
  const detailUrl = record.history?.detail_url;
  const historyTxId = getBridgeHistoryTxId(record);
  const { to: metadataTo } = useBridgeSourceMetadata({
    address: record.address,
    chainId: status.fromToken?.chain,
    hash: status.sourceHash,
    enabled: active && !!sourceChain,
  });
  // 聚合器信息先展示，交互地址异步补齐后再开放浏览器入口。
  const showInteractedContract = !!(
    sourceChain &&
    (record.history?.aggregator || metadataTo)
  );
  const tokenDetail = useCallback(
    (token?: TokenItem) => {
      if (!token) {
        return;
      }
      navigateDeprecated(RootNames.TokenDetail, {
        token: { ...tokenItemToITokenItem(token, record.address), amount: 0 },
        needUseCacheToken: true,
        isSingleAddress: !record.isForMultipleAddress,
        account,
      });
    },
    [record.address, record.isForMultipleAddress, account],
  );
  // 再次跨链先切换到记录对应账户，再打开仅预填原币对的页面。
  const onAgain = async () => {
    if (account) {
      await switchSceneCurrentAccount('MakeTransactionAbout', account);
    }
    naviPush(RootNames.StackTransaction, {
      screen: record.isForMultipleAddress
        ? RootNames.MultiSwapBridge
        : RootNames.SwapBridge,
      params: {
        activeTab: 'bridge',
        chainEnum: sourceChain?.enum,
        tokenId: status.fromToken?.id,
        toChainEnum: toChain?.enum,
        toTokenId: status.toToken?.id,
      },
    });
  };
  const refundLinkAvailable =
    !!status.refundHash &&
    !!findChain({ serverId: status.refundChain })?.scanLink;
  const refundAction = status.detail.action.kind === 'details';
  const supportAction =
    status.detail.action.kind === 'delayed' ||
    status.detail.action.kind === 'support';
  const buttonTitle = t(
    status.completed
      ? 'page.bridge.status.bridgeAgain'
      : supportAction
      ? 'page.bridge.status.contactSupport'
      : refundAction
      ? 'page.bridge.status.viewDetails'
      : 'page.bridge.status.goBack',
  );
  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      overwriteStyle={{ paddingTop: safeOffHeader + 12 }}
      style={styles.container}>
      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <TokenSection
            label={t('page.transactions.detail.From')}
            token={status.fromToken}
            amount={status.fromAmount}
            onPress={() => tokenDetail(status.fromToken)}
            outgoing
          />
          <TokenSection
            label={t('page.transactions.detail.To')}
            token={status.completed ? status.receiveToken : status.toToken}
            amount={status.completed ? status.receiveAmount : status.toAmount}
            approx={!status.completed}
            onPress={() =>
              tokenDetail(
                status.completed ? status.receiveToken : status.toToken,
              )
            }
          />
          <Text style={styles.statusLabel}>
            {t('page.transactions.detail.Status')}
          </Text>
          <BridgeStatusSteps status={status} enabled={active} />
        </View>
        <View style={[styles.card, styles.metadata]}>
          <MetaRow label={t('page.transactions.detail.Date')}>
            <Text style={styles.metaValue}>
              {formatIntlTimestamp(status.createdAt)}
            </Text>
          </MetaRow>
          <MetaRow label={t('page.transactions.detail.From')}>
            <AddressItemInDetail
              address={record.address}
              accounts={accounts}
              addressTextStyle={styles.addressText}
            />
          </MetaRow>
          {showInteractedContract && (
            <ProjectItemInDetail
              title={t('page.transactions.detail.InteractedContract')}
              name={record.history?.aggregator.name}
              logo={record.history?.aggregator.logo_url}
              address={metadataTo}
              chain={sourceChain}
              style={[styles.metaRow, styles.interactedContractRow]}
              addressTextStyle={styles.interactedContractAddress}
            />
          )}
          <MetaRow label={t('page.transactions.detail.Operation')}>
            <Text style={styles.metaValue}>{t('page.bridge.title')}</Text>
          </MetaRow>
          <MetaRow label={t('page.transactions.detail.Chain')}>
            <Text style={styles.metaValue}>
              {sourceChain?.name} → {toChain?.name}
            </Text>
          </MetaRow>
          {!!record.history?.from_gas?.gas_amount && (
            <MetaRow label={t('page.transactions.detail.GasFee')}>
              <Text style={styles.metaValue}>
                {formatTokenAmount(record.history.from_gas.gas_amount)}{' '}
                {getTokenSymbol(record.history.from_gas.native_token)}
              </Text>
            </MetaRow>
          )}
          {!!historyTxId && (
            <MetaRow label="Hash">
              <TouchableOpacity
                style={styles.hashRow}
                disabled={!detailUrl}
                onPress={() => {
                  if (detailUrl) {
                    openExternalUrl(detailUrl);
                  }
                }}>
                <Text style={[styles.metaValue, !!detailUrl && styles.hash]}>
                  {ellipsisAddress(historyTxId)}
                </Text>
                {!!detailUrl && (
                  <Jump
                    width={14}
                    height={14}
                    color={colors2024['neutral-foot']}
                  />
                )}
              </TouchableOpacity>
            </MetaRow>
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <BridgeStatusCaption status={status} onSupport={openBridgeSupport} />
        <Button
          type={
            supportAction || refundAction || status.completed
              ? 'primary'
              : 'plain'
          }
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          titleStyle={{
            ...BOTTOM_BUTTON_TITLE_STYLE,
            ...(!supportAction && !refundAction && !status.completed
              ? { color: colors2024['brand-default'] }
              : {}),
          }}
          buttonStyle={
            !supportAction && !refundAction && !status.completed
              ? { backgroundColor: colors2024['brand-light-1'] }
              : undefined
          }
          title={buttonTitle}
          disabled={refundAction && !refundLinkAvailable}
          onPress={() => {
            if (status.completed) {
              onAgain().catch(error =>
                console.warn('[Bridge] bridge again failed', error),
              );
            } else if (supportAction) {
              openBridgeSupport();
            } else if (refundAction) {
              openTxExternalUrl({
                chain: status.refundChain,
                txHash: status.refundHash,
              });
            } else {
              navigation.goBack();
            }
          }}
        />
      </View>
    </NormalScreenContainer2024>
  );
}

function MetaRow({
  label,
  children,
}: React.PropsWithChildren<{ label: string }>) {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <View style={styles.metaContent}>{children}</View>
    </View>
  );
}

function TokenSection({
  label,
  token,
  amount,
  outgoing,
  approx,
  onPress,
}: {
  label: string;
  token?: TokenItem;
  amount: number;
  outgoing?: boolean;
  approx?: boolean;
  onPress: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  return (
    <View style={styles.tokenSection}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.tokenRow} onPress={onPress}>
        <AssetAvatar
          logo={token?.logo_url}
          chain={token?.chain}
          size={46}
          chainSize={18}
        />
        <View style={styles.tokenInfo}>
          <Text
            style={[styles.tokenAmount, !outgoing && styles.received]}
            numberOfLines={1}>
            {outgoing ? '-' : '+'}
            {approx ? '≈' : ''}
            {formatTokenAmount(amount)} {getTokenSymbol(token)}
          </Text>
          <Text style={styles.tokenUsd}>
            ≈{formatUsdValue(amount * (token?.price || 0))}
          </Text>
        </View>
        <View style={styles.tokenArrow}>
          <Right width={16} height={16} color={colors2024['neutral-body']} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    container: { height: '100%', paddingTop: 24 },
    header: { alignItems: 'center', gap: 2 },
    headerTitle: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '900',
      fontSize: 20,
      lineHeight: 24,
      color: colors2024['neutral-title-1'],
    },
    headerAccount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerWallet: { width: 18, height: 18, borderRadius: 4 },
    headerAddress: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 20,
      color: colors2024['neutral-foot'],
    },
    body: { flex: 1 },
    scroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 16 },
    addressText: { width: 220 },
    card: {
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      padding: 12,
    },
    tokenSection: { marginBottom: 16 },
    label: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
      marginBottom: 8,
    },
    tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tokenInfo: { flex: 1, gap: 2 },
    tokenAmount: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 20,
      lineHeight: 24,
      color: colors2024['neutral-title-1'],
    },
    received: { color: colors2024['green-default'] },
    tokenUsd: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },
    tokenArrow: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors2024['neutral-bg-2'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusLabel: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
      marginBottom: 8,
    },
    metadata: { padding: 16, gap: 24 },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
    },
    interactedContractRow: { alignItems: 'center' },
    interactedContractAddress: { width: 174 },
    metaLabel: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '400',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },
    metaContent: { flex: 1, alignItems: 'flex-end' },
    metaValue: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-body'],
      textAlign: 'right',
    },
    hashRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    hash: { textDecorationLine: 'underline' },
    footer: {
      paddingHorizontal: 20,
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
      gap: 16,
      backgroundColor: colors2024['neutral-bg-1'],
    },
  }),
);
