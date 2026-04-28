import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, ViewProps as RNViewProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import RcIconInfoCC from '@/assets2024/icons/offlineChain/info-cc.svg';
import { Tip } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { DirectSignGasInfoUI } from '@/screens/Bridge/components/DirectSignGasInfoUI';
import { getGasLevelI18nKey } from '@/utils/trans';
import { calcMaxPriorityFee } from '@/utils/transaction';
import { buildDirectSignSummary, calcGasAccountUsd } from './directSignSummary';
import { SignMainnetShowMoreGasModal } from './SignMainnetShowMoreGasModal';
import { SignMainnetCustomGasSheet } from './SignMainnetCustomGasSheet';
import {
  isApprovalGasMethodNotEnough,
  resolveApprovalGasMethod,
} from './approvalGasDisplay';
import { formatGasHeaderUsdValue } from '@/utils/number';
import { useGasAccountSign } from '@/screens/GasAccount/hooks/atom';
import { useGasAccountInfo } from '@/screens/GasAccount/hooks';
import {
  shouldAutoOpenSignMainnetGasModal,
  resolveSignMainnetGasLevelFetchNeeds,
  resolveSignMainnetGasLevelFetchMode,
  shouldFetchSignMainnetGasLevel,
  type SignMainnetGasLevelState,
  type SignMainnetSupportedGasLevel,
} from './signMainnetGasLevelPrefetch';
import type { TempoFeeTokenOption } from '@/utils/tempo';

type GasSelectorHeaderProps = React.ComponentProps<
  typeof import('./GasSelectorHeader').GasSelectorHeader
>;
type SignMainnetGasSelectorHeaderProps = GasSelectorHeaderProps & {
  freeGasAvailable?: boolean;
  noCustomRPC?: boolean;
  showTempoGasTokenSelector?: boolean;
  tempoGasTokenList?: TempoFeeTokenOption[];
  onSelectTempoGasToken?: (token: TempoFeeTokenOption) => void;
  tempoGasTokenLoading?: boolean;
};

export const SignMainnetHeaderContent = ({
  gasList,
  selectedGas,
  chainId,
  gasMethod,
  onChangeGasMethod,
  gasAccountCost,
  gasCostUsdStr,
  nativeTokenInsufficient,
  noCustomRPC,
  freeGasAvailable,
  gasLimit,
  nonce,
  onChange,
  isCancel,
  isSpeedUp,
  gasCalcMethod,
  checkGasLevelIsNotEnough,
  tx,
  gas,
  version,
  isReady,
  is1559,
  isHardware,
  disabled,
  nativeTokenBalance,
  gasPriceMedian,
  account,
  fixedMode,
  defaultFixedModeOnCurrentChain,
  style,
  gasFeeListItemStyle,
  gasFeeListItemInnerStyle,
  textColor,
  gasToken,
  showTempoGasTokenSelector,
  tempoGasTokenList,
  onSelectTempoGasToken,
  tempoGasTokenLoading,
}: {
  gasList: GasSelectorHeaderProps['gasList'];
  selectedGas: GasSelectorHeaderProps['selectedGas'];
  chainId: GasSelectorHeaderProps['chainId'];
  gasMethod?: GasSelectorHeaderProps['gasMethod'];
  onChangeGasMethod?: GasSelectorHeaderProps['onChangeGasMethod'];
  gasAccountCost?: GasSelectorHeaderProps['gasAccountCost'];
  gasCostUsdStr: string;
  nativeTokenInsufficient?: boolean;
  noCustomRPC?: boolean;
  freeGasAvailable?: boolean;
  gasLimit: GasSelectorHeaderProps['gasLimit'];
  nonce: GasSelectorHeaderProps['nonce'];
  onChange: GasSelectorHeaderProps['onChange'];
  isCancel: GasSelectorHeaderProps['isCancel'];
  isSpeedUp: GasSelectorHeaderProps['isSpeedUp'];
  gasCalcMethod: GasSelectorHeaderProps['gasCalcMethod'];
  checkGasLevelIsNotEnough: GasSelectorHeaderProps['checkGasLevelIsNotEnough'];
  tx: GasSelectorHeaderProps['tx'];
  gas: GasSelectorHeaderProps['gas'];
  version: GasSelectorHeaderProps['version'];
  isReady: GasSelectorHeaderProps['isReady'];
  is1559: GasSelectorHeaderProps['is1559'];
  isHardware: GasSelectorHeaderProps['isHardware'];
  disabled: GasSelectorHeaderProps['disabled'];
  nativeTokenBalance: GasSelectorHeaderProps['nativeTokenBalance'];
  gasPriceMedian: GasSelectorHeaderProps['gasPriceMedian'];
  account: GasSelectorHeaderProps['account'];
  fixedMode: GasSelectorHeaderProps['fixedMode'];
  defaultFixedModeOnCurrentChain: GasSelectorHeaderProps['defaultFixedModeOnCurrentChain'];
  style?: RNViewProps['style'];
  gasFeeListItemStyle?: RNViewProps['style'];
  gasFeeListItemInnerStyle?: RNViewProps['style'];
  textColor?: string;
  gasToken?: GasSelectorHeaderProps['gasToken'];
  showTempoGasTokenSelector?: boolean;
  tempoGasTokenList?: TempoFeeTokenOption[];
  onSelectTempoGasToken?: (token: TempoFeeTokenOption) => void;
  tempoGasTokenLoading?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [gasAccountTipVisible, setGasAccountTipVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [showMoreOpen, setShowMoreOpen] = useState(false);
  const [autoOpenSignal, setAutoOpenSignal] = useState(0);
  const hasOpenedOnceRef = useRef(false);
  const noCustomRPCEnabled = noCustomRPC ?? true;
  const displayGasMethod = resolveApprovalGasMethod({
    nativeTokenInsufficient: !!nativeTokenInsufficient,
    gasAccountChainSupported:
      !!gasAccountCost && !gasAccountCost.chain_not_support,
    noCustomRPC: noCustomRPCEnabled,
    freeGasAvailable,
    legacyGasMethod: gasMethod,
  });
  const gasAccountChainSupported =
    !!gasAccountCost && !gasAccountCost.chain_not_support;
  const gasAccountMethodSupported =
    gasAccountChainSupported && noCustomRPCEnabled;
  const summary = useMemo(
    () =>
      buildDirectSignSummary({
        displayGasMethod,
        gasCostUsdStr,
        gasCostAmountStr: '',
        gasAccountCost: gasAccountCost?.gas_account_cost,
      }),
    [displayGasMethod, gasAccountCost?.gas_account_cost, gasCostUsdStr],
  );
  const isSummaryNotEnough = isApprovalGasMethodNotEnough({
    displayMethod: displayGasMethod,
    gasAccountBalanceEnough: gasAccountCost?.balance_is_enough,
    nativeTokenInsufficient: !!nativeTokenInsufficient,
  });
  const summaryValueColor = isSummaryNotEnough
    ? colors2024['red-default']
    : textColor;
  const supportedLevels = useMemo(
    () =>
      gasList.filter(
        gasLevel =>
          gasLevel.level === 'slow' ||
          gasLevel.level === 'normal' ||
          gasLevel.level === 'fast',
      ) as Array<
        (typeof gasList)[number] & { level: SignMainnetSupportedGasLevel }
      >,
    [gasList],
  );
  const selectedSupportedLevel = supportedLevels.find(
    gasLevel => gasLevel.level === selectedGas?.level,
  )?.level;
  const gasAccountUsable =
    gasAccountMethodSupported && !!gasAccountCost?.balance_is_enough;
  const isHeaderLoading = !isReady;
  const isHeaderError = !isHeaderLoading && (!!gas.error || !gas.success);
  const [levelState, setLevelState] = useState<SignMainnetGasLevelState>({});
  const levelStateRef = useRef(levelState);
  const fetchContextIdRef = useRef(0);
  const levelRequestSeqRef = useRef(0);
  const activeLevelRequestsRef = useRef<
    Partial<
      Record<
        SignMainnetSupportedGasLevel,
        { contextId: number; requestId: number }
      >
    >
  >({});
  const fetchMode = resolveSignMainnetGasLevelFetchMode({
    isReady,
    isModalOpen: showMoreOpen,
    nativeTokenInsufficient: !!nativeTokenInsufficient,
    gasAccountUsable,
  });
  const { accountId: gasAccountSessionId } = useGasAccountSign();
  const { value: currentGasAccountInfo } = useGasAccountInfo();
  const levelFetchContextKey = useMemo(
    () =>
      [
        chainId || 0,
        gasAccountSessionId || '',
        currentGasAccountInfo?.account?.balance || '',
        String(gasLimit || ''),
        String(nonce || ''),
        nativeTokenInsufficient ? 1 : 0,
        gasAccountMethodSupported ? 1 : 0,
      ].join(':'),
    [
      chainId,
      currentGasAccountInfo?.account?.balance,
      gasAccountMethodSupported,
      gasAccountSessionId,
      gasLimit,
      nativeTokenInsufficient,
      nonce,
    ],
  );

  useEffect(() => {
    levelStateRef.current = levelState;
  }, [levelState]);

  useEffect(() => {
    activeLevelRequestsRef.current = {};
    setLevelState({});
  }, [levelFetchContextKey]);

  useEffect(() => {
    const contextId = ++fetchContextIdRef.current;

    if (
      fetchMode === 'idle' ||
      !checkGasLevelIsNotEnough ||
      !supportedLevels.length
    ) {
      return;
    }

    const patchLevelState = (
      level: SignMainnetSupportedGasLevel,
      patch: Partial<
        NonNullable<SignMainnetGasLevelState[SignMainnetSupportedGasLevel]>
      >,
    ) => {
      setLevelState(prev => ({
        ...prev,
        [level]: {
          ...prev[level],
          ...patch,
        },
      }));
    };

    supportedLevels.forEach(gasLevel => {
      const { needsNative, needsGasAccount } =
        resolveSignMainnetGasLevelFetchNeeds({
          gasAccountChainSupported: gasAccountMethodSupported,
        });
      const currentLevelState = levelStateRef.current[gasLevel.level];
      const activeRequest = activeLevelRequestsRef.current[gasLevel.level];
      const shouldFetchLevel = shouldFetchSignMainnetGasLevel({
        state: currentLevelState,
        needsNative,
        needsGasAccount,
        hasActiveRequest: activeRequest?.contextId === contextId,
      });

      if ((!needsNative && !needsGasAccount) || !shouldFetchLevel) {
        return;
      }

      const requestId = ++levelRequestSeqRef.current;
      activeLevelRequestsRef.current[gasLevel.level] = {
        contextId,
        requestId,
      };
      patchLevelState(gasLevel.level, { loading: true });

      const gasChange = {
        ...gasLevel,
        gasLimit: Number(gasLimit),
        nonce: Number(nonce),
        level: gasLevel.level,
        maxPriorityFee: calcMaxPriorityFee(
          gasList,
          gasLevel,
          chainId || 0,
          !!(isCancel || isSpeedUp),
        ),
      };

      Promise.all([
        needsNative
          ? Promise.all([
              gasCalcMethod(gasLevel.price).then(res => ({
                nativeUsd: formatGasHeaderUsdValue(res.gasCostUsd.toString(10)),
              })),
              checkGasLevelIsNotEnough(gasChange, 'native').then(
                ([notEnough]) => ({
                  nativeNotEnough: notEnough,
                }),
              ),
            ]).then(([usdPatch, nativePatch]) => ({
              ...usdPatch,
              ...nativePatch,
            }))
          : Promise.resolve({}),
        needsGasAccount
          ? checkGasLevelIsNotEnough(gasChange, 'gasAccount').then(
              ([notEnough, usd]) => ({
                gasAccount: [
                  notEnough,
                  calcGasAccountUsd(Number(usd || 0)),
                ] as [boolean, string],
              }),
            )
          : Promise.resolve({}),
      ])
        .then(([nativePatch, gasAccountPatch]) => {
          const currentRequest = activeLevelRequestsRef.current[gasLevel.level];
          if (
            currentRequest?.contextId !== contextId ||
            currentRequest.requestId !== requestId
          ) {
            return;
          }
          patchLevelState(gasLevel.level, {
            ...nativePatch,
            ...gasAccountPatch,
          });
        })
        .catch(() => {})
        .finally(() => {
          const currentRequest = activeLevelRequestsRef.current[gasLevel.level];
          if (
            currentRequest?.contextId !== contextId ||
            currentRequest.requestId !== requestId
          ) {
            return;
          }
          delete activeLevelRequestsRef.current[gasLevel.level];
          patchLevelState(gasLevel.level, { loading: false });
        });
    });
  }, [
    chainId,
    checkGasLevelIsNotEnough,
    fetchMode,
    gasAccountMethodSupported,
    gasAccountCost,
    gasAccountUsable,
    gasCalcMethod,
    gasLimit,
    gasList,
    isCancel,
    isReady,
    isSpeedUp,
    nativeTokenInsufficient,
    nonce,
    selectedSupportedLevel,
    showMoreOpen,
    supportedLevels,
    levelFetchContextKey,
  ]);

  useEffect(() => {
    if (
      showMoreOpen ||
      hasOpenedOnceRef.current ||
      !shouldAutoOpenSignMainnetGasModal({
        fetchMode,
        selectedSupportedLevel,
        nativeTokenInsufficient: !!nativeTokenInsufficient,
        gasAccountUsable,
        gasAccountChainSupported: gasAccountMethodSupported,
        levelState,
      })
    ) {
      return;
    }

    hasOpenedOnceRef.current = true;
    setAutoOpenSignal(signal => signal + 1);
  }, [
    fetchMode,
    gasAccountMethodSupported,
    gasAccountUsable,
    levelState,
    nativeTokenInsufficient,
    selectedSupportedLevel,
    showMoreOpen,
  ]);

  console.log('SignMainnetHeaderContent', {
    displayGasMethod,
    levelState,
  });

  return (
    <>
      <DirectSignGasInfoUI
        autoOpenSignal={autoOpenSignal}
        style={style}
        loading={isHeaderLoading}
        empty={isHeaderError}
        emptyText={t('page.signTx.failToFetchGasCost')}
        chainId={chainId}
        label={t('page.transactions.detail.GasFee')}
        levelText={t(getGasLevelI18nKey(selectedGas?.level || 'normal'))}
        valueText={summary.primaryText}
        textColor={textColor}
        valueColor={summaryValueColor}
        listItemStyle={gasFeeListItemStyle}
        listItemInnerStyle={gasFeeListItemInnerStyle}
        onOpenChange={open => {
          setShowMoreOpen(open);
          if (open) {
            hasOpenedOnceRef.current = true;
          }
        }}
        renderModal={({ visible, layout, close, chainId: modalChainId }) => (
          <SignMainnetShowMoreGasModal
            visible={visible}
            layout={layout}
            onClose={close}
            chainId={modalChainId}
            gasList={gasList}
            selectedGas={selectedGas}
            gasMethod={gasMethod}
            onChangeGasMethod={onChangeGasMethod}
            gasLimit={gasLimit || '0'}
            nonce={nonce}
            onChange={onChange}
            isCancel={isCancel}
            isSpeedUp={isSpeedUp}
            selectedGasCostUsdStr={gasCostUsdStr}
            gasAccountCost={gasAccountCost}
            nativeTokenInsufficient={nativeTokenInsufficient}
            noCustomRPC={noCustomRPCEnabled}
            freeGasAvailable={freeGasAvailable}
            levelState={levelState}
            gasToken={gasToken}
            showTempoGasTokenSelector={showTempoGasTokenSelector}
            tempoGasTokenList={tempoGasTokenList}
            onSelectTempoGasToken={onSelectTempoGasToken}
            tempoGasTokenLoading={tempoGasTokenLoading}
            onEditCustomGas={() => {
              setCustomVisible(true);
            }}
          />
        )}
        leftIcon={
          displayGasMethod === 'gasAccount' ? (
            <Tip
              isVisible={gasAccountTipVisible}
              onClose={() => {
                setGasAccountTipVisible(false);
              }}
              content={
                <View style={styles.tipContent}>
                  <Text style={styles.tipText}>
                    {t('page.signTx.gasAccount.description')}
                  </Text>
                  <Text style={styles.tipText}>
                    {t('page.signTx.gasAccount.estimatedGas')}{' '}
                    {calcGasAccountUsd(
                      gasAccountCost?.gas_account_cost.estimate_tx_cost || 0,
                    )}
                  </Text>
                  <Text style={styles.tipText}>
                    {t('page.signTx.gasAccount.maxGas')}{' '}
                    {calcGasAccountUsd(
                      gasAccountCost?.gas_account_cost.total_cost || '0',
                    )}
                  </Text>
                  <Text style={styles.tipText}>
                    {t('page.signTx.gasAccount.gasCost')}{' '}
                    {calcGasAccountUsd(
                      gasAccountCost?.gas_account_cost.gas_cost || '0',
                    )}
                  </Text>
                </View>
              }>
              <Pressable
                hitSlop={8}
                onPress={e => {
                  e.stopPropagation();
                  setGasAccountTipVisible(true);
                }}>
                <RcIconInfoCC width={16} height={16} color={'#6A7587'} />
              </Pressable>
            </Tip>
          ) : null
        }
      />
      <SignMainnetCustomGasSheet
        visible={customVisible}
        onClose={() => setCustomVisible(false)}
        tx={tx}
        gas={gas}
        version={version}
        chainId={chainId}
        onChange={onChange}
        isReady={isReady}
        gasLimit={gasLimit}
        nonce={nonce}
        gasList={gasList}
        selectedGas={selectedGas}
        is1559={is1559}
        isHardware={isHardware}
        gasCalcMethod={gasCalcMethod}
        disabled={disabled}
        nativeTokenBalance={nativeTokenBalance}
        gasPriceMedian={gasPriceMedian}
        isCancel={!!isCancel}
        isSpeedUp={!!isSpeedUp}
        account={account}
        fixedMode={fixedMode}
        defaultFixedModeOnCurrentChain={defaultFixedModeOnCurrentChain}
      />
    </>
  );
};

/**
 * SignMainnet uses a dedicated direct-sign-style row plus independent popup
 * and custom-sheet components, so it no longer depends on legacy bridge atoms
 * or the old GasSelectorHeader runtime behavior.
 */
export const SignMainnetGasSelectorHeader = (
  props: SignMainnetGasSelectorHeaderProps,
) => {
  const gasCostUsdStr = formatGasHeaderUsdValue(
    String(props.gas.gasCostUsd || 0),
  );

  return (
    <SignMainnetHeaderContent
      gasList={props.gasList}
      selectedGas={props.selectedGas}
      chainId={props.chainId}
      gasMethod={props.gasMethod}
      onChangeGasMethod={props.onChangeGasMethod}
      gasAccountCost={props.gasAccountCost}
      gasCostUsdStr={gasCostUsdStr}
      nativeTokenInsufficient={props.nativeTokenInsufficient}
      noCustomRPC={props.noCustomRPC}
      freeGasAvailable={props.freeGasAvailable}
      gasLimit={props.gasLimit}
      nonce={props.nonce}
      onChange={props.onChange}
      isCancel={props.isCancel}
      isSpeedUp={props.isSpeedUp}
      gasCalcMethod={props.gasCalcMethod}
      checkGasLevelIsNotEnough={props.checkGasLevelIsNotEnough}
      tx={props.tx}
      gas={props.gas}
      version={props.version}
      isReady={props.isReady}
      is1559={props.is1559}
      isHardware={props.isHardware}
      disabled={props.disabled}
      nativeTokenBalance={props.nativeTokenBalance}
      gasToken={props.gasToken}
      gasPriceMedian={props.gasPriceMedian}
      account={props.account}
      fixedMode={props.fixedMode}
      defaultFixedModeOnCurrentChain={props.defaultFixedModeOnCurrentChain}
      showTempoGasTokenSelector={props.showTempoGasTokenSelector}
      tempoGasTokenList={props.tempoGasTokenList}
      onSelectTempoGasToken={props.onSelectTempoGasToken}
      tempoGasTokenLoading={props.tempoGasTokenLoading}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tipContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
}));
