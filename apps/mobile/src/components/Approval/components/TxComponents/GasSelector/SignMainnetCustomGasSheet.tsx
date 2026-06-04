import BigNumber from 'bignumber.js';
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Keyboard,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  TextInputChangeEventData,
  View,
} from 'react-native';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import { GasLevel, Tx } from '@rabby-wallet/rabby-api/dist/types';
import { Account } from '@/core/services/preference';
import { apiProvider } from '@/core/apis';
import { INPUT_NUMBER_RE } from '@/constant/regexp';
import { calcMaxPriorityFee } from '@/utils/transaction';
import { formatGasHeaderUsdValue, formatTokenAmount } from '@/utils/number';
import { useFindChain } from '@/hooks/useFindChain';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  Tip,
} from '@/components';
import { FooterButton } from '@/components2024/FooterButton/FooterButton';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { Text } from '@/components/Typography';
import { RcIconUnknown } from '@/screens/Approvals/icons';
import { Divide } from '../../Actions/components/Divide';
import IconInfoSVG from '@/assets/icons/common/info-cc.svg';
import { GasSelectContainer } from './GasSelectContainer';
import { getStyle } from './styles';
import {
  buildSignMainnetGasChange,
  type SignMainnetGasChange,
} from './signMainnetCustomGas';
import type { GasTokenInfo } from '@/utils/tempo';
import { BOTTOM_BUTTON_BOTTOM_OFFSET } from '@/constant/layout';

type GasCalcResult = {
  gasCostUsd: BigNumber;
  gasCostAmount: BigNumber;
  maxGasCostAmount?: BigNumber;
};

const useExplainGas = ({
  price,
  method,
  value,
}: {
  price: number;
  method: (price: number) => Promise<GasCalcResult>;
  value: GasCalcResult;
}) => {
  const [result, setResult] = useState<GasCalcResult>(value);

  useEffect(() => {
    method(price).then(setResult);
  }, [method, price]);

  return result;
};

/**
 * Independent custom-gas editor for SignMainnet. It recreates the old gas
 * settings bottom sheet behavior without reaching back into legacy bridge or
 * gas-selector atoms.
 */
export const SignMainnetCustomGasSheet = ({
  visible,
  onClose,
  tx,
  gasLimit = '0',
  gas,
  version,
  chainId,
  onChange,
  isReady,
  nonce,
  gasList,
  selectedGas: rawSelectedGas,
  is1559,
  isHardware,
  gasCalcMethod,
  disabled,
  nativeTokenBalance,
  gasPriceMedian,
  isCancel,
  isSpeedUp,
  account,
  fixedMode,
  defaultFixedModeOnCurrentChain = false,
  gasToken,
}: {
  visible: boolean;
  onClose: () => void;
  tx: Tx;
  gasLimit?: string | undefined;
  gas: {
    gasCostUsd: number | string | BigNumber;
    gasCostAmount: number | string | BigNumber;
    success?: boolean;
    error?: null | {
      msg: string;
      code: number;
    };
  };
  version: 'v0' | 'v1' | 'v2';
  chainId: number;
  onChange(gas: SignMainnetGasChange): void;
  isReady: boolean;
  nonce: string;
  gasList: GasLevel[];
  selectedGas: GasLevel | null;
  is1559: boolean;
  isHardware: boolean;
  gasCalcMethod: (price: number) => Promise<GasCalcResult>;
  disabled?: boolean;
  nativeTokenBalance: string;
  gasPriceMedian: number | null;
  isCancel: boolean;
  isSpeedUp: boolean;
  account: Account;
  fixedMode?: boolean;
  defaultFixedModeOnCurrentChain?: boolean;
  gasToken?: GasTokenInfo;
}) => {
  const { t } = useTranslation();
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();
  const chain = useFindChain({ id: chainId })!;
  const modalRef = useRef<AppBottomSheetModal>(null);

  const [selectedGas, setSelectedGas] = useState<GasLevel | null>(
    rawSelectedGas,
  );
  const [customGas, setCustomGas] = useState<string | number | undefined>();
  const [customGasEstimated, setCustomGasEstimated] = useState<number>(0);
  const [loadingGasEstimated, setLoadingGasEstimated] = useState(false);
  const [isSelectCustom, setIsSelectCustom] = useState(true);
  const [checkedFixedMode, setCheckedFixedMode] = useState(
    defaultFixedModeOnCurrentChain,
  );
  const [maxPriorityFee, setMaxPriorityFee] = useState<string | undefined>(
    rawSelectedGas
      ? String(
          (rawSelectedGas.priority_price === null
            ? rawSelectedGas.price
            : rawSelectedGas.priority_price) / 1e9,
        )
      : '0',
  );
  const [isReal1559, setIsReal1559] = useState(false);
  const hasCustomPriorityFee = useRef(false);

  const loadCustomGasData = useMemoizedFn(
    async (nextCustomGas?: number): Promise<GasLevel | null> => {
      if (chain?.isTestnet) {
        return null;
      }
      const list = await apiProvider.gasMarketV2(
        {
          chain,
          customGas:
            nextCustomGas && nextCustomGas > 0 ? nextCustomGas : undefined,
          tx,
        },
        account,
      );
      return list.find(item => item.level === 'custom') || null;
    },
  );

  const modalExplainGas = useExplainGas({
    price: selectedGas?.price || 0,
    method: gasCalcMethod,
    value: {
      gasCostAmount: new BigNumber(gas.gasCostAmount),
      gasCostUsd: new BigNumber(gas.gasCostUsd),
    },
  });

  const resolvedGasToken = useMemo(
    () =>
      gasToken || {
        tokenId: chain.nativeTokenAddress,
        symbol: chain.nativeTokenSymbol,
        decimals: chain.nativeTokenDecimals || 18,
        logoUrl: chain.nativeTokenLogo,
      },
    [chain, gasToken],
  );

  const gasCostUsdStr = useMemo(() => {
    const bn = new BigNumber(modalExplainGas?.gasCostUsd);
    return formatGasHeaderUsdValue(bn.toString(10));
  }, [modalExplainGas?.gasCostUsd]);

  const gasCostAmountStr = useMemo(
    () =>
      `${formatTokenAmount(
        new BigNumber(modalExplainGas.gasCostAmount).toString(10),
        6,
        true,
      )} ${resolvedGasToken.symbol}`,
    [modalExplainGas.gasCostAmount, resolvedGasToken.symbol],
  );
  const footerStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.footer,
        { paddingBottom: Math.max(BOTTOM_BUTTON_BOTTOM_OFFSET, safeOffBottom) },
      ]),
    [safeOffBottom, styles.footer],
  );

  const hasTip = isReal1559 && isHardware;
  const hasFee = is1559;
  const snapPoint = useMemo(() => {
    let value = 520 + (fixedMode ? 30 : 0);
    if (hasTip) {
      value += 50;
    }
    if (hasFee) {
      value += 100;
    }
    return value;
  }, [fixedMode, hasFee, hasTip]);

  const syncFromProps = useCallback(() => {
    setSelectedGas(rawSelectedGas);
    setCheckedFixedMode(defaultFixedModeOnCurrentChain);
    setIsSelectCustom(true);
    setLoadingGasEstimated(false);
    hasCustomPriorityFee.current = false;

    if (rawSelectedGas?.level === 'custom') {
      setCustomGas(rawSelectedGas.price / 1e9);
      setCustomGasEstimated(rawSelectedGas.estimated_seconds);
    } else {
      setCustomGas(undefined);
      setCustomGasEstimated(
        gasList.find(item => item.level === 'custom')?.estimated_seconds || 0,
      );
    }
  }, [defaultFixedModeOnCurrentChain, gasList, rawSelectedGas]);

  useEffect(() => {
    if (visible) {
      syncFromProps();
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [syncFromProps, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    syncFromProps();
  }, [rawSelectedGas, syncFromProps, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setLoadingGasEstimated(customGas !== undefined);
  }, [customGas, visible]);

  useEffect(() => {
    if (!visible || customGas === undefined || customGas === '') {
      return;
    }

    let mounted = true;
    const timer = setTimeout(() => {
      loadCustomGasData(Number(customGas) * 1e9).then(data => {
        if (!mounted || !data) {
          return;
        }
        setCustomGasEstimated(data.estimated_seconds ?? 0);
        setSelectedGas(prev => ({
          ...prev,
          level: 'custom',
          price: Number(customGas) * 1e9,
          front_tx_count: 0,
          estimated_seconds: data.estimated_seconds ?? 0,
          priority_price: prev?.priority_price ?? null,
          base_fee: data.base_fee ?? 0,
        }));
        setLoadingGasEstimated(false);
      });
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [customGas, loadCustomGasData, visible]);

  useEffect(() => {
    if (!is1559) {
      return;
    }
    const maxPriorityFeeNumber = Number(maxPriorityFee || 0);
    if (selectedGas?.level === 'custom') {
      setIsReal1559(Number(customGas) !== maxPriorityFeeNumber);
      return;
    }
    if (selectedGas) {
      setIsReal1559(selectedGas.price / 1e9 !== maxPriorityFeeNumber);
    }
  }, [customGas, is1559, maxPriorityFee, selectedGas]);

  const isNilCustomGas = customGas === undefined || customGas === '';
  const notSelectCustomGasAndIsNil = !isSelectCustom && isNilCustomGas;
  const isLoadingGas = loadingGasEstimated || isNilCustomGas;
  const isCustomLoading =
    isSelectCustom && !isNilCustomGas && loadingGasEstimated;
  const isCustomDisabled =
    isCustomLoading || (isSelectCustom && isNilCustomGas);

  useEffect(() => {
    if (!isReady || !selectedGas) {
      return;
    }

    if (isSelectCustom && isNilCustomGas && !hasCustomPriorityFee.current) {
      setMaxPriorityFee(undefined);
      return;
    }

    let priorityPrice = calcMaxPriorityFee(
      gasList,
      selectedGas,
      chainId,
      isSpeedUp || isCancel,
    );

    setMaxPriorityFee(prevFee => {
      if (hasCustomPriorityFee.current) {
        priorityPrice = Math.min(
          selectedGas.price,
          Number(prevFee || priorityPrice / 1e9) * 1e9,
        );
      }
      return String(priorityPrice / 1e9);
    });
  }, [
    chainId,
    gasList,
    isCancel,
    isNilCustomGas,
    isReady,
    isSelectCustom,
    isSpeedUp,
    selectedGas,
  ]);

  useEffect(() => {
    if (
      (selectedGas && selectedGas.level !== 'custom') ||
      (selectedGas?.level === 'custom' && !selectedGas.price)
    ) {
      setCheckedFixedMode(false);
    }
  }, [selectedGas]);

  useEffect(() => {
    if (isSelectCustom && !customGas) {
      setCheckedFixedMode(false);
    }
  }, [customGas, isSelectCustom]);

  const handleCustomGasChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    e.stopPropagation();
    if (INPUT_NUMBER_RE.test(e.nativeEvent.text)) {
      setCustomGas(e.nativeEvent.text);
    }
  };

  const panelSelection = (e, nextGas: GasLevel) => {
    e.stopPropagation();
    setIsSelectCustom(nextGas.level === 'custom');

    if (nextGas.level === 'custom') {
      if (customGas === undefined || customGas === '') {
        return;
      }

      setSelectedGas({
        ...nextGas,
        level: 'custom',
        price: Number(customGas) * 1e9,
      });
      return;
    }

    setSelectedGas({
      ...nextGas,
      level: nextGas.level,
    });
  };

  const handleMaxPriorityFeeChange = (val: string) => {
    if (!INPUT_NUMBER_RE.test(val)) {
      return;
    }
    let priorityFeeMax = selectedGas ? selectedGas.price / 1e9 : 0;

    if (selectedGas?.level === 'custom' && customGas !== undefined) {
      priorityFeeMax = Number(customGas);
    }

    if (val === '') {
      setMaxPriorityFee(undefined);
      return;
    }

    const num = Number(val);
    if (Number.isNaN(num) || num < 0) {
      return;
    }
    if (num > priorityFeeMax) {
      setMaxPriorityFee(String(priorityFeeMax));
      return;
    }

    hasCustomPriorityFee.current = true;
    setMaxPriorityFee(val);
  };

  const handleConfirm = () => {
    if (!selectedGas) {
      return;
    }

    onChange(
      buildSignMainnetGasChange({
        gas: selectedGas,
        gasLimit: Number(gasLimit),
        nonce: Number(nonce),
        maxPriorityFeeGwei: Number(maxPriorityFee || 0),
        customGasGwei:
          selectedGas.level === 'custom' ? Number(customGas || 0) : undefined,
        fixedMode: checkedFixedMode,
      }),
    );
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <AppBottomSheetModal
      keyboardBlurBehavior="restore"
      snapPoints={[snapPoint]}
      ref={modalRef}
      backgroundStyle={styles.modalBackground}
      handleStyle={styles.modalBackground}
      onDismiss={onClose}>
      <View style={styles.modalWrap}>
        <AppBottomSheetModalTitle
          style={styles.sheetTitle}
          title={t('page.signTx.gasSetting')}
        />
        <BottomSheetScrollView
          style={styles.modalScrollView}
          onScrollBeginDrag={Keyboard.dismiss}>
          <View style={styles.gasSelectorModalTop}>
            {disabled ? (
              <Text style={styles.gasSelectorModalAmount}>
                {t('page.signTx.noGasRequired')}
              </Text>
            ) : gas.error || !gas.success ? (
              <>
                <Text style={styles.gasSelectorModalError}>
                  {t('page.signTx.failToFetchGasCost')}
                </Text>
                {version === 'v2' && gas.error ? (
                  <View style={styles.gasSelectorModalErrorDesc}>
                    <Text style={styles.gasSelectorModalErrorDescText}>
                      {gas.error.msg} #{gas.error.code}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View>
                <Text style={styles.gasSelectorModalAmount}>
                  {gasCostUsdStr}
                </Text>
                <View style={styles.gasSelectorModalUsdWrap}>
                  {resolvedGasToken.logoUrl ? (
                    <Image
                      source={{ uri: resolvedGasToken.logoUrl }}
                      width={16}
                      height={16}
                      style={StyleSheet.flatten({ borderRadius: 16 })}
                    />
                  ) : (
                    <RcIconUnknown
                      width={16}
                      height={16}
                      style={StyleSheet.flatten({ borderRadius: 16 })}
                    />
                  )}
                  <Text style={styles.gasSelectorModalUsd}>
                    {gasCostAmountStr}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.cardContainer}>
            <Text
              style={StyleSheet.flatten([
                styles.cardContainerTitle,
                disabled && styles.cardContainerTitleDisabled,
              ])}>
              {t('page.signTx.gasPriceTitle')}
            </Text>
            <Tip
              content={
                disabled
                  ? t('page.signTx.gasNotRequireForSafeTransaction')
                  : undefined
              }>
              <GasSelectContainer
                isSelectCustom={isSelectCustom}
                gasList={gasList}
                selectedGas={selectedGas}
                panelSelection={panelSelection}
                customGas={customGas}
                handleCustomGasChange={handleCustomGasChange}
                disabled={disabled}
                notSelectCustomGasAndIsNil={notSelectCustomGasAndIsNil}
                isLoadingGas={isLoadingGas}
                customGasEstimated={customGasEstimated}
              />
            </Tip>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.gasPriceDesc}>
              <View style={styles.gasPriceDescItem}>
                <View style={styles.gasPriceDescDot} />
                <Text>
                  <Text style={styles.gasPriceDescText}>
                    {t('page.signTx.myNativeTokenBalance')}
                  </Text>
                  <Text style={styles.gasPriceDescBoldText}>
                    {formatTokenAmount(
                      new BigNumber(nativeTokenBalance)
                        .div(new BigNumber(10).pow(resolvedGasToken.decimals))
                        .toFixed(),
                      4,
                      true,
                    )}{' '}
                    {resolvedGasToken.symbol}
                  </Text>
                </Text>
              </View>
              {gasPriceMedian !== null ? (
                <View style={styles.gasPriceDescItem}>
                  <View style={styles.gasPriceDescDot} />
                  <Text>
                    <Text style={styles.gasPriceDescText}>
                      {t('page.signTx.gasPriceMedian')}
                    </Text>
                    <Text style={styles.gasPriceDescBoldText}>
                      {new BigNumber(gasPriceMedian).div(1e9).toFixed()} Gwei
                    </Text>
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.feeContainer}>
            {hasFee ? (
              <>
                <Divide style={styles.feeDivider} />
                <View
                  style={StyleSheet.flatten([
                    styles.feeHeader,
                    maxPriorityFee === undefined ? { opacity: 0.5 } : {},
                  ])}>
                  <Text style={styles.feeHeaderText}>
                    {t('page.signTx.maxPriorityFee')}
                  </Text>
                  <Tip
                    content={
                      <View style={styles.feeTip}>
                        <Text style={styles.feeTipText}>
                          {t('page.signTx.eip1559Desc1')}
                        </Text>
                        <Text style={styles.feeTipText}>
                          {t('page.signTx.eip1559Desc2')}
                        </Text>
                      </View>
                    }>
                    <IconInfoSVG
                      color={colors2024['neutral-foot']}
                      width={14}
                      height={14}
                    />
                  </Tip>
                </View>

                <Tip
                  content={
                    isSelectCustom && isNilCustomGas
                      ? t('page.signTx.maxPriorityFeeDisabledAlert')
                      : undefined
                  }>
                  <BottomSheetTextInput
                    style={styles.feeInput}
                    value={maxPriorityFee?.toString()}
                    onChange={e =>
                      handleMaxPriorityFeeChange(e.nativeEvent.text)
                    }
                  />
                </Tip>
              </>
            ) : null}

            {fixedMode &&
            (selectedGas?.level === 'custom' || isSelectCustom) ? (
              <Pressable
                disabled={
                  (selectedGas?.level === 'custom' && !selectedGas.price) ||
                  (isSelectCustom &&
                    selectedGas?.level !== 'custom' &&
                    !customGas)
                }
                style={[
                  styles.fixedModeContainer,
                  (selectedGas?.level === 'custom' && !selectedGas.price) ||
                  (isSelectCustom &&
                    selectedGas?.level !== 'custom' &&
                    !customGas)
                    ? { opacity: 0.5 }
                    : {},
                ]}
                onPress={() => setCheckedFixedMode(prev => !prev)}>
                <CheckBoxRect checked={checkedFixedMode} />
                <Text style={styles.fixedModeText}>
                  {t('page.miniSignFooterBar.fixedModeText')}
                </Text>
              </Pressable>
            ) : null}

            {hasTip ? (
              <View style={styles.gasPriceDesc}>
                <Text style={styles.gasPriceDescText}>
                  {t('page.signTx.hardwareSupport1559Alert')}
                </Text>
              </View>
            ) : null}
          </View>
        </BottomSheetScrollView>

        <FooterButton
          footerStyle={footerStyle}
          type="primary"
          onPress={handleConfirm}
          disabled={!isReady || isCustomDisabled}
          loading={isCustomLoading}
          title={t('global.confirm')}
        />
      </View>
    </AppBottomSheetModal>
  );
};
