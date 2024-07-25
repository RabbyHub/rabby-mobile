import BigNumber from 'bignumber.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { calcMaxPriorityFee } from '@/utils/transaction';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { GasLevel, TxPushType } from '@rabby-wallet/rabby-api/dist/types';
import {
  Image,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInputChangeEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApprovalSecurityEngine } from '../../../hooks/useApprovalSecurityEngine';
import {
  CAN_ESTIMATE_L1_FEE_CHAINS,
  L2_ENUMS,
  MINIMUM_GAS_LIMIT,
} from '@/constant/gas';
import { getStyles } from './styles';
import { useThemeColors } from '@/hooks/theme';
import SecurityLevelTagNoText from '../../SecurityEngine/SecurityLevelTagNoText';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  Tip,
} from '@/components';
import { formatTokenAmount } from '@/utils/number';
import IconQuestionMark from '@/assets/icons/sign/question-mark.svg';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { GasSelectContainer } from './GasSelectContainer';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { TextInput } from 'react-native-gesture-handler';
import { matomoRequestEvent } from '@/utils/analytics';
import { Skeleton } from '@rneui/themed';
import GasLogoSVG from '@/assets/icons/sign/tx/gas-logo-cc.svg';
import { calcGasEstimated } from '@/utils/time';
import { GasMenuButton } from './GasMenuButton';
import { INPUT_NUMBER_RE } from '@/constant/regexp';
import { openapi } from '@/core/request';
import { RcIconUnknown } from '@/screens/Approvals/icons';
import { Divide } from '../../Actions/components/Divide';
import IconInfoSVG from '@/assets/icons/common/info-cc.svg';
import { useFindChain } from '@/hooks/useFindChain';

export interface GasSelectorResponse extends GasLevel {
  gasLimit: number;
  nonce: number;
  maxPriorityFee: number;
}

interface GasSelectorProps {
  gasLimit: string | undefined;
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
  onChange(gas: GasSelectorResponse): void;
  isReady: boolean;
  recommendGasLimit: number | string | BigNumber;
  recommendNonce: number | string | BigNumber;
  nonce: string;
  disableNonce: boolean;
  noUpdate: boolean;
  gasList: GasLevel[];
  selectedGas: GasLevel | null;
  is1559: boolean;
  isHardware: boolean;
  isCancel: boolean;
  isSpeedUp: boolean;
  gasCalcMethod: (price: number) => Promise<{
    gasCostUsd: BigNumber;
    gasCostAmount: BigNumber;
  }>;
  disabled?: boolean;
  manuallyChangeGasLimit: boolean;
  errors: {
    code: number;
    msg: string;
    level?: 'warn' | 'danger' | 'forbidden';
  }[];
  engineResults?: Result[];
  nativeTokenBalance: string;
  gasPriceMedian: number | null;
  pushType?: TxPushType;
}

const useExplainGas = ({
  price,
  method,
  value,
}: {
  price: number;
  method: GasSelectorProps['gasCalcMethod'];
  value: {
    gasCostUsd: BigNumber;
    gasCostAmount: BigNumber;
  };
}) => {
  const [result, setResult] = useState<{
    gasCostUsd: BigNumber;
    gasCostAmount: BigNumber;
  }>(value);
  useEffect(() => {
    method(price).then(setResult);
  }, [price, method]);

  return result;
};

export const GasSelectorHeader = ({
  gasLimit = '0',
  gas,
  chainId,
  onChange,
  isReady,
  recommendNonce,
  nonce = '0',
  disableNonce,
  gasList,
  selectedGas: rawSelectedGas,
  is1559,
  isHardware,
  version,
  gasCalcMethod,
  disabled,
  engineResults = [],
  nativeTokenBalance,
  gasPriceMedian,
  isCancel,
  isSpeedUp,
}: GasSelectorProps) => {
  const { t } = useTranslation();
  const customerInputRef = useRef<TextInput>(null);
  const [afterGasLimit, setGasLimit] = useState<string | number>(
    Number(gasLimit),
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [customGas, setCustomGas] = useState<string | number>('0');
  const [selectedGas, setSelectedGas] = useState<GasLevel | null>(
    rawSelectedGas,
  );
  const [maxPriorityFee, setMaxPriorityFee] = useState<number | undefined>(
    selectedGas
      ? (selectedGas.priority_price === null
          ? selectedGas.price
          : selectedGas.priority_price) / 1e9
      : 0,
  );
  const [isReal1559, setIsReal1559] = useState(false);
  const [customNonce, setCustomNonce] = useState(Number(nonce));
  const [isFirstTimeLoad, setIsFirstTimeLoad] = useState(true);
  const [validateStatus, setValidateStatus] = useState<
    Record<string, { status: any; message: string | null }>
  >({
    customGas: {
      status: 'success',
      message: null,
    },
    gasLimit: {
      status: 'success',
      message: null,
    },
    nonce: {
      status: 'success',
      message: null,
    },
  });
  const chain = useFindChain({
    id: chainId,
  })!;
  const hasCustomPriorityFee = useRef(false);
  const [customGasEstimated, setCustomGasEstimated] = useState<number>(0);

  const {
    rules,
    currentTx: { processedRules },
    ...apiApprovalSecurityEngine
  } = useApprovalSecurityEngine();

  const loadCustomGasData = React.useCallback(
    async (custom?: number): Promise<GasLevel> => {
      const list = await openapi.gasMarket(
        chain.serverId,
        custom && custom > 0 ? custom : undefined,
      );
      return list.find(item => item.level === 'custom')!;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const formValidator = () => {
    if (!afterGasLimit) {
      setValidateStatus({
        ...validateStatus,
        gasLimit: {
          status: 'error',
          message: t('page.signTx.gasLimitEmptyAlert'),
        },
      });
    } else if (Number(afterGasLimit) < MINIMUM_GAS_LIMIT) {
      setValidateStatus({
        ...validateStatus,
        gasLimit: {
          status: 'error',
          message: t('page.signTx.gasLimitMinValueAlert'),
        },
      });
    } else if (new BigNumber(customNonce).lt(recommendNonce) && !disableNonce) {
      setValidateStatus({
        ...validateStatus,
        nonce: {
          status: 'error',
          // @ts-ignore
          message: t('page.signTx.nonceLowerThanExpect', [
            new BigNumber(recommendNonce).toString(),
          ]),
        },
      });
    } else {
      setValidateStatus({
        ...validateStatus,
        gasLimit: {
          status: 'success',
          message: null,
        },
        nonce: {
          status: 'success',
          message: null,
        },
      });
    }
  };

  const modalExplainGas = useExplainGas({
    price: selectedGas?.price || 0,
    method: gasCalcMethod,
    value: {
      gasCostAmount: new BigNumber(gas.gasCostAmount),
      gasCostUsd: new BigNumber(gas.gasCostUsd),
    },
  });

  const handleConfirmGas = () => {
    if (!selectedGas) return;
    if (selectedGas.level === 'custom') {
      onChange({
        ...selectedGas,
        price: Number(customGas) * 1e9,
        gasLimit: Number(afterGasLimit),
        nonce: Number(customNonce),
        level: selectedGas.level,
        maxPriorityFee: (maxPriorityFee ?? 0) * 1e9,
      });
    } else {
      onChange({
        ...selectedGas,
        gasLimit: Number(afterGasLimit),
        nonce: Number(customNonce),
        level: selectedGas.level,
        maxPriorityFee: (maxPriorityFee ?? 0) * 1e9,
      });
    }
  };

  const handleModalConfirmGas = () => {
    handleConfirmGas();
    setModalVisible(false);
  };

  const [changedCustomGas, setChangedCustomGas] = useState(false);

  const handleCustomGasChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    e.stopPropagation();
    if (INPUT_NUMBER_RE.test(e.nativeEvent.text)) {
      setCustomGas(e.nativeEvent.text);
      setChangedCustomGas(e.nativeEvent.text === '' ? false : true);
    }
  };

  const hiddenCustomGas = useMemo(() => {
    return customGas === '0' && !changedCustomGas;
  }, [customGas, changedCustomGas]);

  const [isSelectCustom, setIsSelectCustom] = useState(false);
  const handleClickEdit = () => {
    setModalVisible(true);
    if (rawSelectedGas?.level !== 'custom') {
      setSelectedGas(rawSelectedGas);
      setGasLimit(Number(gasLimit));
      setCustomNonce(Number(nonce));
      setIsSelectCustom(true);
    }
    matomoRequestEvent({
      category: 'Transaction',
      action: 'EditGas',
      label: chain?.serverId,
    });
    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 50);
  };

  const [prevSelectedNotCustomGas, setPrevSelectedNotCustomGas] =
    useState<GasLevel | null>(null);

  const panelSelection = (e, gas: GasLevel) => {
    e.stopPropagation();
    const target = gas;

    // if (gas.level === selectedGas?.level) return;
    setIsSelectCustom(gas.level === 'custom');

    if (gas.level === 'custom') {
      setTimeout(() => {
        customerInputRef.current?.focus();
      }, 50);

      if (!changedCustomGas) {
        return;
      }

      setSelectedGas({
        ...target,
        level: 'custom',
      });
    } else {
      setSelectedGas({
        ...gas,
        level: gas?.level,
      });
    }
  };

  const externalPanelSelection = (gas: GasLevel) => {
    const target = gas;

    if (gas.level === 'custom') {
      if (!changedCustomGas) return;
      onChange({
        ...target,
        level: 'custom',
        price: Number(target.price),
        gasLimit: Number(afterGasLimit),
        nonce: Number(customNonce),
        maxPriorityFee: calcMaxPriorityFee(
          gasList,
          target,
          chainId,
          isCancel || isSpeedUp,
        ),
      });
    } else {
      onChange({
        ...gas,
        gasLimit: Number(afterGasLimit),
        nonce: Number(customNonce),
        level: gas?.level,
        maxPriorityFee: calcMaxPriorityFee(
          gasList,
          target,
          chainId,
          isCancel || isSpeedUp,
        ),
      });
    }
  };

  const customGasConfirm = e => {
    const customGas = gasList.find(item => item.level === 'custom')!;
    const gas = {
      ...customGas,
      price: Number(e?.target?.value),
    };
    setSelectedGas({
      ...gas,
      price: Number(gas.price),
      level: gas.level,
    });
  };

  let priorityFeeMax = selectedGas ? selectedGas.price / 1e9 : 0;
  const handleMaxPriorityFeeChange = (val: any) => {
    if (
      selectedGas?.level === 'custom' &&
      changedCustomGas &&
      customGas !== undefined
    ) {
      priorityFeeMax = Number(customGas);
    }
    if (val === '') {
      setMaxPriorityFee(undefined);
      return;
    }
    const number = Number(val);
    if (number < 0) return;
    if (number > priorityFeeMax) {
      setMaxPriorityFee(priorityFeeMax);
      return;
    }
    hasCustomPriorityFee.current = true; // flag user has customized priorityFee
    setMaxPriorityFee(val);
  };

  const handleClickRule = (id: string) => {
    const rule = rules.find(item => item.id === id);
    if (!rule) return;
    const result = engineResultMap[id];
    apiApprovalSecurityEngine.openRuleDrawer({
      ruleConfig: rule,
      value: result?.value,
      level: result?.level,
      ignored: processedRules.includes(id),
    });
  };
  const [loadingGasEstimated, setLoadingGasEstimated] = useState(false);

  // reset loading state when custom gas change
  useEffect(() => {
    setLoadingGasEstimated(true);
  }, [customGas]);

  useEffect(() => {
    setTimeout(() => {
      if (isReady || !isFirstTimeLoad) {
        loadCustomGasData(Number(customGas) * 1e9).then(data => {
          if (data) setCustomGasEstimated(data.estimated_seconds);
          setSelectedGas(gas => ({
            ...gas,
            level: 'custom',
            price: Number(customGas) * 1e9,
            front_tx_count: 0,
            estimated_seconds: data?.estimated_seconds ?? 0,
            priority_price: null,
            base_fee: data?.base_fee ?? 0,
          }));
          setLoadingGasEstimated(false);
        });
      }
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customGas]);

  useEffect(() => {
    setGasLimit(Number(gasLimit));
  }, [gasLimit]);

  useEffect(() => {
    formValidator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterGasLimit, selectedGas, gasList, customNonce]);

  useEffect(() => {
    if (!rawSelectedGas) return;
    setSelectedGas(rawSelectedGas);
    if (rawSelectedGas?.level !== 'custom') return;
    setCustomGas(e =>
      Number(e) * 1e9 === rawSelectedGas.price ? e : rawSelectedGas.price / 1e9,
    );
    setChangedCustomGas(true);
    setLoadingGasEstimated(false);
  }, [rawSelectedGas]);

  useEffect(() => {
    setCustomNonce(Number(nonce));
  }, [nonce]);

  useEffect(() => {
    if (isReady && isFirstTimeLoad) {
      setIsFirstTimeLoad(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  useEffect(() => {
    apiApprovalSecurityEngine.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedGas) {
      setPrevSelectedNotCustomGas(selectedGas);
    }
    if (!is1559) return;
    if (selectedGas?.level === 'custom') {
      if (Number(customGas) !== maxPriorityFee) {
        setIsReal1559(true);
      } else {
        setIsReal1559(false);
      }
    } else if (selectedGas) {
      if (selectedGas?.price / 1e9 !== maxPriorityFee) {
        setIsReal1559(true);
      } else {
        setIsReal1559(false);
      }
    }
  }, [maxPriorityFee, selectedGas, customGas, is1559]);

  const isNilCustomGas = customGas === undefined || customGas === '';
  const notSelectCustomGasAndIsNil = !isSelectCustom && isNilCustomGas;
  const isLoadingGas = loadingGasEstimated || isNilCustomGas;

  useEffect(() => {
    if (hasCustomPriorityFee.current) return; // use custom priorityFee if user changed custom field
    if (isReady && selectedGas && chainId === 1) {
      if (isSelectCustom && isNilCustomGas) {
        setMaxPriorityFee(undefined);
        return;
      }
      if (selectedGas.priority_price && selectedGas.priority_price !== null) {
        setMaxPriorityFee(selectedGas.priority_price / 1e9);
      } else {
        const priorityFee = calcMaxPriorityFee(
          gasList,
          selectedGas,
          chainId,
          isSpeedUp || isCancel,
        );
        setMaxPriorityFee(priorityFee / 1e9);
      }
    } else if (selectedGas) {
      setMaxPriorityFee(selectedGas.price / 1e9);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasList, selectedGas, isReady, chainId, isSelectCustom, isNilCustomGas]);

  useEffect(() => {
    const customGas = gasList.find(item => item.level === 'custom');
    if (customGas) {
      setCustomGasEstimated(customGas.estimated_seconds);
    }
  }, [gasList]);

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const modalRef = useRef<AppBottomSheetModal>(null);
  useEffect(() => {
    if (modalVisible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [modalVisible]);

  const gasCostUsdStr = useMemo(() => {
    const bn = new BigNumber(modalExplainGas?.gasCostUsd);
    let value;

    if (bn.gt(1)) {
      value = bn.toFixed(2);
    } else if (bn.gt(0.0001)) {
      value = bn.toFixed(4);
    } else {
      value = '0.0001';
    }

    return `$${formatTokenAmount(value)}`;
  }, [modalExplainGas?.gasCostUsd]);

  const gasCostAmountStr = useMemo(() => {
    return `${formatTokenAmount(
      new BigNumber(modalExplainGas.gasCostAmount).toString(10),
      6,
    )} ${chain.nativeTokenSymbol}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalExplainGas?.gasCostAmount]);

  const [isGasHovering, setIsGasHovering] = useState(false);

  const handleClosePopup = () => {
    if (maxPriorityFee === undefined) {
      setSelectedGas(prevSelectedNotCustomGas);
    }
    setModalVisible(false);
  };

  const hasTip = isReal1559 && isHardware;
  const hasFee = is1559;
  const snapPoint = React.useMemo(() => {
    let v = 500;
    if (hasTip) {
      v += 50;
    }
    if (hasFee) {
      v += 100;
    }
    return v;
  }, [hasFee, hasTip]);

  if (!isReady && isFirstTimeLoad) {
    return (
      <View style={styles.header}>
        <Skeleton style={StyleSheet.flatten({ width: 130, height: 20 })} />
        <Skeleton style={StyleSheet.flatten({ width: 130, height: 20 })} />
      </View>
    );
  }

  if (disabled) {
    return null;
  }

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setIsGasHovering(!isGasHovering)}
          style={styles.gasView}>
          <GasLogoSVG
            color={colors['neutral-foot']}
            style={StyleSheet.flatten({
              flexShrink: 0,
            })}
          />

          <View style={styles.gasSelectorCardContent}>
            {disabled ? (
              <Text style={styles.gasSelectorCardContentText}>
                {t('page.signTx.noGasRequired')}
              </Text>
            ) : gas.error || !gas.success ? (
              <>
                <Text style={styles.gasSelectorCardErrorText}>
                  {t('page.signTx.failToFetchGasCost')}
                </Text>
              </>
            ) : (
              <View style={styles.gasSelectorCardContentItem}>
                <View style={styles.gasSelectorCardAmount}>
                  <Text
                    style={StyleSheet.flatten([
                      styles.gasSelectorCardAmountLabel,
                      !processedRules.includes('1118') &&
                      engineResultMap['1118']?.level === 'danger'
                        ? { color: colors['red-default'] }
                        : {},
                      !processedRules.includes('1118') &&
                      engineResultMap['1118']?.level === 'warning'
                        ? { color: colors['orange-default'] }
                        : {},
                    ])}>
                    {gasCostUsdStr}
                  </Text>
                  {L2_ENUMS.includes(chain.enum) &&
                    !CAN_ESTIMATE_L1_FEE_CHAINS.includes(chain.enum) && (
                      <View
                        style={StyleSheet.flatten({
                          position: 'relative',
                          marginLeft: 6,
                        })}>
                        <Tip content={t('page.signTx.l2GasEstimateTooltip')}>
                          <IconQuestionMark width={14} />
                        </Tip>
                      </View>
                    )}
                </View>
              </View>
            )}
          </View>

          {gas.success && (
            <Text style={styles.gasCostAmount}>
              {isGasHovering
                ? calcGasEstimated(selectedGas?.estimated_seconds)
                : `~${gasCostAmountStr}`}
            </Text>
          )}
          {engineResultMap['1118'] && (
            <SecurityLevelTagNoText
              enable={engineResultMap['1118'].enable}
              level={
                processedRules.includes('1118')
                  ? 'proceed'
                  : engineResultMap['1118'].level
              }
              onClick={() => handleClickRule('1118')}
              right={-46}
            />
          )}
        </TouchableOpacity>
        <GasMenuButton
          gasList={gasList}
          selectedGas={selectedGas}
          onSelect={externalPanelSelection}
          onCustom={handleClickEdit}
          showCustomGasPrice={changedCustomGas}
        />
      </View>

      <AppBottomSheetModal
        keyboardBlurBehavior="restore"
        snapPoints={[snapPoint]}
        ref={modalRef}
        handleStyle={{
          backgroundColor: colors['neutral-bg2'],
        }}
        onDismiss={handleClosePopup}>
        <BottomSheetView style={styles.modalWrap}>
          <AppBottomSheetModalTitle title={t('page.signTx.gasSelectorTitle')} />
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
                  {chain.nativeTokenLogo ? (
                    <Image
                      source={{ uri: chain.nativeTokenLogo }}
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
                customGasConfirm={customGasConfirm}
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
                <Text style={styles.gasPriceDescText}>
                  {t('page.signTx.myNativeTokenBalance')}
                </Text>
                <Text style={styles.gasPriceDescBoldText}>
                  {formatTokenAmount(
                    new BigNumber(nativeTokenBalance).div(1e18).toFixed(),
                    4,
                    true,
                  )}{' '}
                  {chain.nativeTokenSymbol}
                </Text>
              </View>
              {gasPriceMedian !== null && (
                <View style={styles.gasPriceDescItem}>
                  <Text style={styles.gasPriceDescText}>
                    {t('page.signTx.gasPriceMedian')}
                  </Text>
                  <Text style={styles.gasPriceDescBoldText}>
                    {new BigNumber(gasPriceMedian).div(1e9).toFixed()} Gwei
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.feeContainer}>
            {hasFee && (
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
                      color={colors['neutral-foot']}
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
            )}

            {hasTip && (
              <View style={styles.gasPriceDesc}>
                <Text style={styles.gasPriceDescText}>
                  {t('page.signTx.hardwareSupport1559Alert')}
                </Text>
              </View>
            )}
          </View>

          <FooterButton
            footerStyle={styles.footer}
            type="primary"
            onPress={handleModalConfirmGas}
            disabled={!isReady || validateStatus.customGas.status === 'error'}
            title={t('global.confirm')}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </>
  );
};
