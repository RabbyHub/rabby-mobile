import BigNumber from 'bignumber.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { calcMaxPriorityFee } from '@/utils/transaction';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { GasSelectPanel } from './GasSelectPanel';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInputChangeEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { CHAINS } from '@/constant/chains';
import { useApprovalSecurityEngine } from '../../../hooks/useApprovalSecurityEngine';
import {
  CAN_ESTIMATE_L1_FEE_CHAINS,
  L2_ENUMS,
  MINIMUM_GAS_LIMIT,
} from '@/constant/gas';
import { GasSelectorSkeleton } from './GasSelectorSkeleton';
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
import IconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import clsx from 'clsx';
import IconAlertCC from '@/assets/icons/sign/alert-currentcolor-cc.svg';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { GasSelectContainer } from './GasSelectContainer';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { TextInput } from 'react-native-gesture-handler';

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

const GasSelector = ({
  gasLimit = '0',
  gas,
  chainId,
  onChange,
  isReady,
  recommendGasLimit,
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
  manuallyChangeGasLimit,
  errors,
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
  const [maxPriorityFee, setMaxPriorityFee] = useState<number>(
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
  const chain = Object.values(CHAINS).find(item => item.id === chainId)!;

  const {
    rules,
    currentTx: { processedRules },
    ...apiApprovalSecurityEngine
  } = useApprovalSecurityEngine();

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const handleSetRecommendTimes = () => {
    if (disabled) return;
    const value = new BigNumber(recommendGasLimit).times(1.5).toFixed(0);
    setGasLimit(value);
  };

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
          // @ts-expect-error
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
        maxPriorityFee: maxPriorityFee * 1e9,
      });
    } else {
      onChange({
        ...selectedGas,
        gasLimit: Number(afterGasLimit),
        nonce: Number(customNonce),
        level: selectedGas.level,
        maxPriorityFee: maxPriorityFee * 1e9,
      });
    }
  };

  const handleModalConfirmGas = () => {
    handleConfirmGas();
    setModalVisible(false);
  };

  const handleCustomGasChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    e.stopPropagation();
    if (/^\d*(\.\d*)?$/.test(e.nativeEvent.text)) {
      setCustomGas(e.nativeEvent.text);
    }
  };

  const handleGasLimitChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    if (/^\d*$/.test(e.nativeEvent.text)) {
      setGasLimit(e.nativeEvent.text);
    }
  };

  const handleCustomNonceChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    if (/^\d*$/.test(e.nativeEvent.text)) {
      setCustomNonce(Number(e.nativeEvent.text));
    }
  };

  const handleClickEdit = () => {
    setModalVisible(true);
    setSelectedGas(rawSelectedGas);
    setGasLimit(Number(gasLimit));
    setCustomNonce(Number(nonce));
    // matomoRequestEvent({
    //   category: 'Transaction',
    //   action: 'EditGas',
    //   label: chain?.serverId,
    // });
  };

  const panelSelection = (e, gas: GasLevel) => {
    e.stopPropagation();
    const target = gas;

    if (gas.level === selectedGas?.level) return;

    if (gas.level === 'custom') {
      setSelectedGas({
        ...target,
        level: 'custom',
      });
      customerInputRef.current?.focus();
    } else {
      setSelectedGas({
        ...gas,
        level: gas?.level,
      });
    }
  };

  const handlePanelSelection = (e, gas: GasLevel) => {
    if (disabled) return;
    return panelSelection(e, gas);
  };

  const externalPanelSelection = (e, gas: GasLevel) => {
    e.stopPropagation();
    const target = gas;
    if (gas.level === 'custom') {
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

  const externalHandleCustomGasChange = (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    e.stopPropagation();

    if (/^\d*(\.\d*)?$/.test(e.nativeEvent.text)) {
      let value = e?.nativeEvent.text || '';
      if (value.trim() === '.') {
        value = '0.';
      }
      setCustomGas(value);

      const gasObj = {
        level: 'custom',
        front_tx_count: 0,
        estimated_seconds: 0,
        base_fee: gasList[0].base_fee,
        priority_price: 0,
      };

      const currentObj = {
        ...gasObj,
        ...rawSelectedGas,
        front_tx_count: 0,
        estimated_seconds: 0,
        base_fee: gasList[0].base_fee,
        price: Number(value) * 1e9,
        level: 'custom',
        gasLimit: Number(afterGasLimit),
        nonce: Number(customNonce),
        maxPriorityFee: Number(value) * 1e9,
      };
      onChange(currentObj);
    }
  };

  const customGasConfirm = e => {
    const gas = {
      level: 'custom',
      price: Number(e?.nativeEvent.text),
      front_tx_count: 0,
      estimated_seconds: 0,
      base_fee: gasList[0].base_fee,
      priority_price: null,
    };
    console.log('eee');
    setSelectedGas({
      ...gas,
      price: Number(gas.price),
      level: gas.level,
    });
  };

  const handleMaxPriorityFeeChange = (val: number) => {
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

  useEffect(() => {
    setTimeout(() => {
      (isReady || !isFirstTimeLoad) &&
        setSelectedGas(gas => ({
          ...gas,
          level: 'custom',
          price: Number(customGas) * 1e9,
          front_tx_count: 0,
          estimated_seconds: 0,
          priority_price: null,
          base_fee: gasList[0].base_fee,
        }));
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customGas]);

  useEffect(() => {
    setGasLimit(Number(gasLimit));
  }, [gasLimit]);

  useEffect(() => {
    formValidator();
  }, [afterGasLimit, selectedGas, gasList, customNonce]);

  useEffect(() => {
    if (!rawSelectedGas) return;
    setSelectedGas(rawSelectedGas);
    if (rawSelectedGas?.level !== 'custom') return;
    setCustomGas(e =>
      Number(e) * 1e9 === rawSelectedGas.price ? e : rawSelectedGas.price / 1e9,
    );
  }, [rawSelectedGas]);

  useEffect(() => {
    setCustomNonce(Number(nonce));
  }, [nonce]);

  useEffect(() => {
    if (isReady && isFirstTimeLoad) {
      setIsFirstTimeLoad(false);
    }
  }, [isReady]);

  useEffect(() => {
    apiApprovalSecurityEngine.init();
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (isReady && selectedGas && chainId === 1) {
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
  }, [gasList, selectedGas, isReady, chainId]);
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

  if (!isReady && isFirstTimeLoad) {
    return <GasSelectorSkeleton />;
  }

  return (
    <View>
      <View style={styles.gasSelector}>
        <View
          style={styles.gasSelectorCard}
          className={clsx(
            gas.error || !gas.success ? 'items-start mb-12' : 'mb-12',
          )}>
          <View style={styles.gasSelectorCardMain}>
            <Text style={styles.gasSelectorCardTitle}>
              {t('page.signTx.gasSelectorTitle')}
            </Text>
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
                  <View
                    style={styles.gasSelectorCardAmount}
                    className="flex items-center">
                    <Text style={styles.gasSelectorCardAmountLabel}>
                      {formatTokenAmount(
                        new BigNumber(gas.gasCostAmount).toString(10),
                        6,
                      )}{' '}
                      {chain.nativeTokenSymbol}
                    </Text>
                    <Text style={styles.gasSelectorCardAmountText}>
                      &nbsp; ≈${new BigNumber(gas.gasCostUsd).toFixed(2)}
                    </Text>
                    {L2_ENUMS.includes(chain.enum) &&
                      !CAN_ESTIMATE_L1_FEE_CHAINS.includes(chain.enum) && (
                        <View className="relative ml-6">
                          <Tip content={t('page.signTx.l2GasEstimateTooltip')}>
                            <IconQuestionMark className="w-14" />
                          </Tip>
                        </View>
                      )}
                  </View>
                </View>
              )}
            </View>
            {engineResultMap['1118'] && (
              <SecurityLevelTagNoText
                enable={engineResultMap['1118'].enable}
                level={
                  processedRules.includes('1118')
                    ? 'proceed'
                    : engineResultMap['1118'].level
                }
                onClick={() => handleClickRule('1118')}
                right={-40}
                // className="security-level-tag"
              />
            )}
          </View>
          <View className="flex-1" />
          <TouchableOpacity
            style={styles.gasMore}
            role="button"
            onPress={handleClickEdit}>
            <Text style={styles.gasMoreText}>
              {t('page.signTx.gasMoreButton')}
            </Text>
            <IconArrowRight />
          </TouchableOpacity>
        </View>
        <GasSelectPanel
          gasList={gasList}
          selectedGas={rawSelectedGas}
          panelSelection={externalPanelSelection}
          customGas={customGas}
          handleCustomGasChange={externalHandleCustomGasChange}
          disabled={disabled}
          chain={chain}
          nativeTokenBalance={nativeTokenBalance}
          gasPriceMedian={gasPriceMedian}
        />
        {manuallyChangeGasLimit && (
          <Text style={styles.manuallySetGasLimitAlert}>
            {t('page.signTx.manuallySetGasLimitAlert')} {Number(gasLimit)}
          </Text>
        )}
        {errors.length > 0 && (
          <View style={styles.errorWrap}>
            {errors.map(error => (
              <View style={styles.errorWrapItem} key={error.code}>
                <IconAlertCC
                  style={styles.errorWrapIcon}
                  color={colors['neutral-body']}
                />
                <Text className="flex-1">
                  {error.msg} #{error.code}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <AppBottomSheetModal
        snapPoints={['80%']}
        ref={modalRef}
        onDismiss={() => setModalVisible(false)}>
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
                      {gas.error.msg}{' '}
                    </Text>
                    <Text>#{gas.error.code}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View>
                <Text style={styles.gasSelectorModalAmount}>
                  {formatTokenAmount(
                    new BigNumber(modalExplainGas.gasCostAmount).toString(10),
                    6,
                  )}{' '}
                  {chain.nativeTokenSymbol}
                </Text>
                <Text style={styles.gasSelectorModalUsd}>
                  ≈${modalExplainGas.gasCostUsd.toFixed(2)}
                </Text>
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
                gasList={gasList}
                selectedGas={selectedGas}
                panelSelection={panelSelection}
                customGas={customGas}
                customGasConfirm={customGasConfirm}
                handleCustomGasChange={handleCustomGasChange}
                disabled={disabled}
              />
            </Tip>
          </View>
          <View style={styles.formContainer}>
            {/* TODO: 目前只支持 WalletConnect，所以 is1559 一直为 false */}
            {/* {is1559 && (
              <View className="priority-slider">
                <Text className="priority-slider-header">
                  {t('page.signTx.maxPriorityFee')}
                  <Tip
                    content={
                      <View className="list-decimal list-outside pl-[12px] mb-0">
                        <Text>{t('page.signTx.eip1559Desc1')}</Text>
                        <Text>{t('page.signTx.eip1559Desc2')}</Text>
                      </View>
                    }>
                    <IconInfo className="icon icon-info" />
                  </Tip>
                </Text>
                <View className="priority-slider-body">
                  <Slider
                    min={0}
                    max={selectedGas ? selectedGas.price / 1e9 : 0}
                    onChange={handleMaxPriorityFeeChange}
                    value={maxPriorityFee}
                    step={0.01}
                  />
                  <p className="priority-slider__mark">
                    <span>0</span>
                    <span>{selectedGas ? selectedGas.price / 1e9 : 0}</span>
                  </p>
                </View>
              </View>
            )} */}
            {/* {isReal1559 && isHardware && (
              <div className="hardware-1559-tip">
                {t('page.signTx.hardwareSupport1559Alert')}
              </div>
            )} */}
            <View>
              <View style={styles.gasLimitLabel}>
                <Text
                  style={StyleSheet.flatten([
                    styles.gasLimitLabelText,
                    disabled && styles.gasLimitLabelTextDisabled,
                  ])}>
                  {t('page.signTx.gasLimitTitle')}
                </Text>
              </View>
              <View>
                <Tip
                  content={
                    disabled
                      ? t('page.signTx.gasNotRequireForSafeTransaction')
                      : undefined
                  }>
                  {/* <Form.Item
                    className={clsx('gas-limit-panel mb-0', {
                      disabled: disabled,
                    })}
                    validateStatus={validateStatus.gasLimit.status}> */}
                  <BottomSheetTextInput
                    keyboardType="number-pad"
                    style={styles.gasLimitInput}
                    value={afterGasLimit.toString()}
                    onChange={handleGasLimitChange}
                    // disabled={disabled}
                  />
                </Tip>
                {validateStatus.gasLimit.message ? (
                  <Text
                    style={StyleSheet.flatten([
                      styles.tip,
                      {
                        color: colors['red-default'],
                      },
                    ])}>
                    {validateStatus.gasLimit.message}
                  </Text>
                ) : (
                  <View className="flex flex-row items-baseline">
                    <Text
                      style={StyleSheet.flatten([
                        styles.tip,
                        disabled && styles.tipDisabled,
                      ])}>
                      <Trans
                        i18nKey="page.signTx.recommendGasLimitTip"
                        values={{
                          est: Number(recommendGasLimit),
                          current: new BigNumber(afterGasLimit)
                            .div(recommendGasLimit)
                            .toFixed(1),
                        }}
                      />
                    </Text>
                    <TouchableOpacity onPress={handleSetRecommendTimes}>
                      <Text
                        style={StyleSheet.flatten([
                          styles.tip,
                          styles.recommendTimes,
                          disabled && styles.tipDisabled,
                        ])}>
                        1.5x
                      </Text>
                    </TouchableOpacity>
                    <Text>.</Text>
                  </View>
                )}
                <View className={clsx({ 'opacity-50': disableNonce })}>
                  <Text style={styles.gasLimitLabelText}>
                    {t('page.signTx.nonceTitle')}
                  </Text>
                  <BottomSheetTextInput
                    keyboardType="number-pad"
                    style={styles.gasLimitInput}
                    value={customNonce.toString()}
                    onChange={handleCustomNonceChange}
                    // disabled={disableNonce}
                  />
                  {validateStatus.nonce.message ? (
                    <Text
                      style={StyleSheet.flatten([
                        styles.tip,
                        {
                          color: colors['red-default'],
                        },
                      ])}>
                      {validateStatus.nonce.message}
                    </Text>
                  ) : (
                    <Text style={styles.tip}>
                      {t('page.signTx.gasLimitModifyOnlyNecessaryAlert')}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
          <View className="flex-1" />
          <FooterButton
            type="primary"
            onPress={handleModalConfirmGas}
            disabled={!isReady || validateStatus.customGas.status === 'error'}
            title={t('global.confirm')}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </View>
  );
};

export default GasSelector;
