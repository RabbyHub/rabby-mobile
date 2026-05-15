import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  TouchableOpacity,
  View,
  ViewProps as RNViewProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import RcIconInfoCC from '@/assets2024/icons/offlineChain/info-cc.svg';
import { default as RcIconGasActive } from '@/assets/icons/sign/tx/gas-active.svg';
import { default as RcIconGasBlurCC } from '@/assets/icons/sign/tx/gas-blur-cc.svg';
import { default as RcIconGasAccountBlurCC } from '@/assets/icons/sign/tx/gas-account-blur-cc.svg';
import { default as RcIconGasAccountActive } from '@/assets/icons/sign/tx/gas-account-active.svg';
import { Tip } from '@/components';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
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
  resolveSignMainnetAutoDowngradeGasLevel,
  resolveSignMainnetGasLevelFetchNeeds,
  resolveSignMainnetGasLevelFetchMode,
  shouldFetchSignMainnetGasLevel,
  type SignMainnetGasLevelState,
  type SignMainnetSupportedGasLevel,
} from './signMainnetGasLevelPrefetch';
import type { TempoFeeTokenOption } from '@/utils/tempo';
import type { SvgProps } from 'react-native-svg';

type GasSelectorHeaderProps = React.ComponentProps<
  typeof import('./GasSelectorHeader').GasSelectorHeader
>;
type SignMainnetGasSelectorHeaderProps = GasSelectorHeaderProps & {
  freeGasAvailable?: boolean;
  noCustomRPC?: boolean;
  showTempoGasTokenSelector?: boolean;
  showGasMethodShortcut?: boolean;
  tempoGasTokenList?: TempoFeeTokenOption[];
  onSelectTempoGasToken?: (token: TempoFeeTokenOption) => void;
  tempoGasTokenLoading?: boolean;
  onGasSettingsOpenChange?: (open: boolean) => void;
  tempoPreferredFeeTokenId?: string;
  onAutoChangeGasMethod?: (value: 'native' | 'gasAccount') => void;
  disableAutoGasLevelSwitch?: boolean;
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
  showGasMethodShortcut = true,
  tempoGasTokenList,
  onSelectTempoGasToken,
  tempoGasTokenLoading,
  onGasSettingsOpenChange,
  tempoPreferredFeeTokenId,
  onAutoChangeGasMethod,
  disableAutoGasLevelSwitch = false,
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
  showGasMethodShortcut?: boolean;
  tempoGasTokenList?: TempoFeeTokenOption[];
  onSelectTempoGasToken?: (token: TempoFeeTokenOption) => void;
  tempoGasTokenLoading?: boolean;
  onGasSettingsOpenChange?: (open: boolean) => void;
  tempoPreferredFeeTokenId?: string;
  onAutoChangeGasMethod?: (value: 'native' | 'gasAccount') => void;
  disableAutoGasLevelSwitch?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [gasAccountTipVisible, setGasAccountTipVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [showMoreOpen, setShowMoreOpen] = useState(false);
  const [autoOpenSignal, setAutoOpenSignal] = useState(0);
  const hasOpenedOnceRef = useRef(false);
  const gasSettingsOpen = showMoreOpen || customVisible;
  const gasSettingsOpenRef = useRef(gasSettingsOpen);
  const onGasSettingsOpenChangeRef = useRef(onGasSettingsOpenChange);
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
  const gasMethodShortcut =
    showGasMethodShortcut && gasMethod && onChangeGasMethod && !disabled ? (
      <GasMethodShortcut
        gasMethod={displayGasMethod}
        onChangeGasMethod={onChangeGasMethod}
      />
    ) : null;
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
  const supportedGasLevelPrices = useMemo(
    () =>
      supportedLevels.map(gasLevel => ({
        level: gasLevel.level,
        price: Number(gasLevel.price),
      })),
    [supportedLevels],
  );
  const txFeeToken =
    (tx as (typeof tx & { feeToken?: string }) | undefined)?.feeToken || '';
  const requestFingerprint = useMemo(
    () =>
      [
        tx?.chainId || chainId || 0,
        tx?.from || '',
        tx?.to || '',
        tx?.value || '',
        tx?.data || '',
        txFeeToken,
        String(gasLimit || ''),
        String(nonce || ''),
        gasToken?.tokenId || '',
        gasToken?.decimals || '',
        nativeTokenBalance || '',
        tempoPreferredFeeTokenId || '',
        isCancel ? '1' : '0',
        isSpeedUp ? '1' : '0',
        supportedGasLevelPrices
          .map(item => `${item.level}:${item.price}`)
          .join(','),
      ].join('|'),
    [
      chainId,
      gasLimit,
      gasToken?.decimals,
      gasToken?.tokenId,
      isCancel,
      isSpeedUp,
      nativeTokenBalance,
      nonce,
      supportedGasLevelPrices,
      tempoPreferredFeeTokenId,
      tx?.chainId,
      tx?.data,
      tx?.from,
      tx?.to,
      tx?.value,
      txFeeToken,
    ],
  );
  const gasAccountUsable =
    gasAccountMethodSupported && !!gasAccountCost?.balance_is_enough;
  const isHeaderLoading = !isReady;
  const isHeaderError = !isHeaderLoading && (!!gas.error || !gas.success);
  const [levelState, setLevelState] = useState<SignMainnetGasLevelState>({});
  const levelStateRef = useRef(levelState);
  const fetchContextIdRef = useRef(0);
  const levelRequestSeqRef = useRef(0);
  const autoDowngradeKeyRef = useRef('');
  const autoDowngradeResultRef = useRef<{
    level: SignMainnetSupportedGasLevel;
    price: number;
  } | null>(null);
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
        requestFingerprint,
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
      requestFingerprint,
    ],
  );

  useEffect(() => {
    levelStateRef.current = levelState;
  }, [levelState]);

  useEffect(() => {
    onGasSettingsOpenChangeRef.current = onGasSettingsOpenChange;
  }, [onGasSettingsOpenChange]);

  useEffect(() => {
    if (gasSettingsOpenRef.current === gasSettingsOpen) {
      return;
    }

    gasSettingsOpenRef.current = gasSettingsOpen;
    onGasSettingsOpenChangeRef.current?.(gasSettingsOpen);
  }, [gasSettingsOpen]);

  useEffect(() => {
    return () => {
      if (gasSettingsOpenRef.current) {
        onGasSettingsOpenChangeRef.current?.(false);
      }
    };
  }, []);

  useEffect(() => {
    activeLevelRequestsRef.current = {};
    setLevelState({});
  }, [levelFetchContextKey]);

  const buildGasChange = useCallback(
    (gasLevel: (typeof supportedLevels)[number]) => ({
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
    }),
    [chainId, gasLimit, gasList, isCancel, isSpeedUp, nonce],
  );

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
        requestFingerprint,
      });

      if ((!needsNative && !needsGasAccount) || !shouldFetchLevel) {
        return;
      }

      const requestId = ++levelRequestSeqRef.current;
      activeLevelRequestsRef.current[gasLevel.level] = {
        contextId,
        requestId,
      };
      patchLevelState(gasLevel.level, {
        loading: true,
        fingerprint: requestFingerprint,
      });

      const gasChange = buildGasChange(gasLevel);

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
              ([notEnough, usd, gasAccountResult]) => ({
                gasAccount: [
                  notEnough,
                  calcGasAccountUsd(Number(usd || 0)),
                ] as [boolean, string],
                gasAccountResult,
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
            fingerprint: requestFingerprint,
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
          patchLevelState(gasLevel.level, {
            loading: false,
            fingerprint: requestFingerprint,
          });
        });
    });
  }, [
    chainId,
    buildGasChange,
    checkGasLevelIsNotEnough,
    fetchMode,
    gasAccountMethodSupported,
    gasAccountCost,
    gasAccountUsable,
    gasCalcMethod,
    isReady,
    nativeTokenInsufficient,
    requestFingerprint,
    selectedSupportedLevel,
    showMoreOpen,
    supportedLevels,
    levelFetchContextKey,
  ]);

  useEffect(() => {
    if (
      disableAutoGasLevelSwitch ||
      freeGasAvailable ||
      disabled ||
      !isReady ||
      fetchMode !== 'prefetch'
    ) {
      return;
    }

    if (selectedSupportedLevel) {
      const selectedLevelState = levelState[selectedSupportedLevel];
      if (
        !selectedLevelState ||
        selectedLevelState.fingerprint !== requestFingerprint ||
        selectedLevelState.loading ||
        selectedLevelState.nativeNotEnough === undefined
      ) {
        return;
      }

      if (selectedLevelState.nativeNotEnough === false) {
        return;
      }
    }

    const autoDowngradeResult = autoDowngradeResultRef.current;
    if (
      autoDowngradeResult?.level === selectedGas?.level &&
      autoDowngradeResult?.price === Number(selectedGas?.price)
    ) {
      return;
    }

    const nextGasLevel = resolveSignMainnetAutoDowngradeGasLevel({
      selectedSupportedLevel,
      selectedGasPrice: Number(selectedGas?.price),
      supportedGasLevels: supportedGasLevelPrices,
      gasAccountChainSupported: gasAccountMethodSupported,
      levelState,
      requestFingerprint,
    });

    if (!nextGasLevel) {
      return;
    }

    const gasLevel = supportedLevels.find(
      item => item.level === nextGasLevel.level,
    );
    const changeGasMethod = onAutoChangeGasMethod || onChangeGasMethod;

    if (!gasLevel || !changeGasMethod) {
      return;
    }

    const switchKey = [
      requestFingerprint,
      selectedSupportedLevel || '',
      selectedGas?.level || '',
      selectedGas?.price || '',
      nextGasLevel.level,
      nextGasLevel.gasMethod,
    ].join('|');

    if (autoDowngradeKeyRef.current === switchKey) {
      return;
    }

    autoDowngradeKeyRef.current = switchKey;
    autoDowngradeResultRef.current = {
      level: nextGasLevel.level,
      price: Number(gasLevel.price),
    };
    void changeGasMethod(nextGasLevel.gasMethod);
    onChange(buildGasChange(gasLevel));
  }, [
    buildGasChange,
    disableAutoGasLevelSwitch,
    disabled,
    fetchMode,
    freeGasAvailable,
    gasAccountMethodSupported,
    isReady,
    levelState,
    onAutoChangeGasMethod,
    onChange,
    onChangeGasMethod,
    requestFingerprint,
    selectedGas?.level,
    selectedGas?.price,
    selectedSupportedLevel,
    supportedGasLevelPrices,
    supportedLevels,
  ]);

  return (
    <>
      <DirectSignGasInfoUI
        style={style}
        loading={isHeaderLoading}
        empty={isHeaderError}
        emptyText={t('page.signTx.failToFetchGasCost')}
        chainId={chainId}
        label={gasMethodShortcut ? null : t('page.transactions.detail.GasFee')}
        labelPrefix={gasMethodShortcut}
        levelText={t(getGasLevelI18nKey(selectedGas?.level || 'normal'))}
        valueText={summary.primaryText}
        textColor={textColor}
        valueColor={summaryValueColor}
        listItemStyle={gasFeeListItemStyle}
        listItemInnerStyle={gasFeeListItemInnerStyle}
        onOpenChange={setShowMoreOpen}
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
        gasToken={gasToken}
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
      tempoPreferredFeeTokenId={props.tempoPreferredFeeTokenId}
      showGasMethodShortcut={props.showGasMethodShortcut}
      onAutoChangeGasMethod={props.onAutoChangeGasMethod}
      disableAutoGasLevelSwitch={props.disableAutoGasLevelSwitch}
      onGasSettingsOpenChange={props.onGasSettingsOpenChange}
    />
  );
};

const GasMethodShortcut = ({
  gasMethod,
  onChangeGasMethod,
}: {
  gasMethod: 'native' | 'gasAccount';
  onChangeGasMethod: (value: 'native' | 'gasAccount') => void;
}) => {
  const colors = useThemeColors();

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 2,
        borderRadius: 6,
        borderWidth: 0.5,
        borderStyle: 'solid',
        borderColor: colors['neutral-line'],
        marginRight: 12,
      }}>
      <GasMethod
        active={gasMethod === 'native'}
        onChange={() => {
          onChangeGasMethod('native');
        }}
        ActiveComponent={RcIconGasActive}
        BlurComponent={RcIconGasBlurCC}
      />

      <GasMethod
        active={gasMethod === 'gasAccount'}
        onChange={() => {
          onChangeGasMethod('gasAccount');
        }}
        ActiveComponent={RcIconGasAccountActive}
        BlurComponent={RcIconGasAccountBlurCC}
      />
    </View>
  );
};

const GasMethod = (props: {
  active: boolean;
  onChange: () => void;
  ActiveComponent: React.FC<SvgProps>;
  BlurComponent: React.FC<SvgProps>;
}) => {
  const { active, onChange, ActiveComponent, BlurComponent } = props;
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      style={{
        width: 32,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
        backgroundColor: active ? colors['blue-light-1'] : 'transparent',
      }}
      onPress={event => {
        event.stopPropagation();
        onChange();
      }}>
      <ActiveComponent
        style={{
          display: active ? 'flex' : 'none',
        }}
      />
      <BlurComponent
        color={colors['neutral-foot']}
        style={{
          display: active ? 'none' : 'flex',
        }}
      />
    </TouchableOpacity>
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
