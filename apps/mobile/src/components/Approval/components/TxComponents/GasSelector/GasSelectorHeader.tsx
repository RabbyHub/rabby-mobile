import BigNumber from 'bignumber.js';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { calcMaxPriorityFee } from '@/utils/transaction';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { GasLevel, Tx, TxPushType } from '@rabby-wallet/rabby-api/dist/types';
import {
  Image,
  Keyboard,
  NativeSyntheticEvent,
  Pressable,
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
import { getStyle } from './styles';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import SecurityLevelTagNoText from '../../SecurityEngine/SecurityLevelTagNoText';
import {
  AppBottomSheetModal,
  AppBottomSheetModalTitle,
  Tip,
} from '@/components';
import { formatTokenAmount, formatGasHeaderUsdValue } from '@/utils/number';
import IconQuestionMark from '@/assets/icons/sign/question-mark.svg';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { GasSelectContainer } from './GasSelectContainer';
import { FooterButton } from '@/components2024/FooterButton/FooterButton';
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
import { isTestnet } from '@/utils/chain';
import { useMemoizedFn, useThrottleEffect } from 'ahooks';

import { default as RcIconGasActive } from '@/assets/icons/sign/tx/gas-active.svg';
import { default as RcIconGasBlurCC } from '@/assets/icons/sign/tx/gas-blur-cc.svg';

import { default as RcIconGasAccountBlurCC } from '@/assets/icons/sign/tx/gas-account-blur-cc.svg';
import { default as RcIconGasAccountActive } from '@/assets/icons/sign/tx/gas-account-active.svg';
import { SvgProps } from 'react-native-svg';
import { RcIconInfoCC } from '@/assets/icons/common';
import { apiProvider } from '@/core/apis';
import useDebounce from 'react-use/lib/useDebounce';
import { Account } from '@/core/services/preference';
import { CheckBoxRect } from '@/components2024/CheckBox';
import {
  useGetShowMoreGasSelectVisible,
  useSetGasInfoByUI,
} from '@/screens/Bridge/components/ShowMoreGasModal';
export interface GasSelectorResponse extends GasLevel {
  gasLimit: number;
  nonce: number;
  maxPriorityFee: number;
  fixedMode?: boolean;
}

interface GasSelectorProps {
  tx: Tx;
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
    maxGasCostAmount?: BigNumber;
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
  isDisabledGasPopup?: boolean;
  gasMethod?: 'native' | 'gasAccount';
  onChangeGasMethod?(value: 'native' | 'gasAccount'): void;
  gasAccountCost?: {
    gas_account_cost: {
      total_cost: number;
      tx_cost: number;
      gas_cost: number;
      estimate_tx_cost: number;
    };
    is_gas_account: boolean;
    balance_is_enough: boolean;
    chain_not_support: boolean;
  };
  directSubmit?: boolean;
  checkGasLevelIsNotEnough?: (
    gas: GasSelectorResponse,
    type?: 'gasAccount' | 'native',
  ) => Promise<[boolean, number]>;
  account: Account;
  fixedMode?: boolean;
  defaultFixedModeOnCurrentChain?: boolean;
  nativeTokenInsufficient?: boolean;
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
    maxGasCostAmount?: BigNumber;
  };
}) => {
  const [result, setResult] = useState<{
    gasCostUsd: BigNumber;
    gasCostAmount: BigNumber;
    maxGasCostAmount?: BigNumber;
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
  isDisabledGasPopup,
  gasMethod,
  gasAccountCost,
  onChangeGasMethod,
  tx,
  checkGasLevelIsNotEnough,
  directSubmit,
  account,
  fixedMode,
  defaultFixedModeOnCurrentChain = false,
  nativeTokenInsufficient,
}: GasSelectorProps) => {
  const { t } = useTranslation();
  const customerInputRef = useRef<TextInput>(null);
  const [afterGasLimit, setGasLimit] = useState<string | number>(
    Number(gasLimit),
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [customGas, setCustomGas] = useState<string | number | undefined>();
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

  const loadCustomGasData = useMemoizedFn(
    async (custom?: number): Promise<GasLevel | null> => {
      if (chain?.isTestnet) {
        return null;
      }
      const list = await apiProvider.gasMarketV2(
        {
          chain,
          customGas: custom && custom > 0 ? custom : undefined,
          tx,
        },
        account,
      );
      return list.find(item => item.level === 'custom')!;
    },
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

  const gasSlowUsd = useExplainGas({
    price: gasList.find(e => e.level === 'slow')?.price || 0,
    method: gasCalcMethod,
    value: {
      gasCostAmount: new BigNumber(gas.gasCostAmount),
      gasCostUsd: new BigNumber(gas.gasCostUsd),
    },
  }).gasCostUsd;

  const gasNormalUsd = useExplainGas({
    price: gasList.find(e => e.level === 'normal')?.price || 0,
    method: gasCalcMethod,
    value: {
      gasCostAmount: new BigNumber(gas.gasCostAmount),
      gasCostUsd: new BigNumber(gas.gasCostUsd),
    },
  }).gasCostUsd;

  const gasFastUsd = useExplainGas({
    price: gasList.find(e => e.level === 'fast')?.price || 0,
    method: gasCalcMethod,
    value: {
      gasCostAmount: new BigNumber(gas.gasCostAmount),
      gasCostUsd: new BigNumber(gas.gasCostUsd),
    },
  }).gasCostUsd;

  const [gasIsNotEnough, setGasIsNotEnough] = useState({
    slow: false,
    normal: false,
    fast: false,
  });
  const [gasAccountIsNotEnough, setGasAccountIsNotEnough] = useState<{
    slow: [boolean, string];
    normal: [boolean, string];
    fast: [boolean, string];
  }>({
    slow: [false, ''],
    normal: [false, ''],
    fast: [false, ''],
  });

  const calcGasAccountUsd = useCallback((n: number | string) => {
    const v = Number(n);
    if (!Number.isNaN(v) && v < 0.0001) {
      return `$${n}`;
    }
    return formatGasHeaderUsdValue(n || '0');
  }, []);

  useDebounce(
    () => {
      if (
        checkGasLevelIsNotEnough &&
        gasList.length &&
        directSubmit &&
        isReady
      ) {
        let init = true;
        ['slow', 'normal', 'fast'].forEach(level => {
          const selectedGas = gasList.find(e => e.level === level);
          checkGasLevelIsNotEnough(
            {
              ...gasList.find(e => e.level === level),
              gasLimit: Number(afterGasLimit),
              nonce: Number(customNonce),
              level: selectedGas!.level,
              maxPriorityFee: calcMaxPriorityFee(
                gasList,
                selectedGas!,
                chainId,
                isCancel || isSpeedUp,
              ),
            } as GasSelectorResponse,
            'native',
          )
            .then(arr => {
              if (init) {
                setGasIsNotEnough(pre => ({ ...pre, [level]: arr[0] }));
              }
            })
            .catch(e => {
              console.log('checkGasLevelIsNotEnough native gas error', e);
            });
        });

        return () => {
          init = false;
        };
      }
    },
    3,
    [
      isReady,
      directSubmit,
      afterGasLimit,
      checkGasLevelIsNotEnough,
      customNonce,
      gasList,
      chainId,
      isCancel,
      isSpeedUp,
    ],
  );

  const outGasModalIsOpen = useGetShowMoreGasSelectVisible();
  const gasAccountStateInit = useRef(false);

  useDebounce(
    () => {
      if (
        checkGasLevelIsNotEnough &&
        gasList.length &&
        directSubmit &&
        isReady &&
        outGasModalIsOpen &&
        !gasAccountStateInit.current
      ) {
        let init = true;
        ['slow', 'normal', 'fast'].forEach(level => {
          const selectedGas = gasList.find(e => e.level === level);
          checkGasLevelIsNotEnough(
            {
              ...gasList.find(e => e.level === level),
              gasLimit: Number(afterGasLimit),
              nonce: Number(customNonce),
              level: selectedGas!.level,
              maxPriorityFee: calcMaxPriorityFee(
                gasList,
                selectedGas!,
                chainId,
                isCancel || isSpeedUp,
              ),
            } as GasSelectorResponse,
            'gasAccount',
          )
            .then(arr => {
              if (init) {
                gasAccountStateInit.current = true;
                // setGasAccountIsNotEnough()
                setGasAccountIsNotEnough(pre => ({
                  ...pre,
                  [level]: [
                    arr[0],
                    calcGasAccountUsd((arr[1] as unknown as number) || 0),
                  ],
                }));
              }
            })
            .catch(e => {
              console.log('checkGasLevelIsNotEnough gasAccount error', e);
            });
        });

        return () => {
          init = false;
        };
      }
    },
    100,
    [
      outGasModalIsOpen,
      isReady,
      directSubmit,
      afterGasLimit,
      checkGasLevelIsNotEnough,
      customNonce,
      gasList,
      chainId,
      isCancel,
      isSpeedUp,
      calcGasAccountUsd,
    ],
  );

  const [isSelectCustom, setIsSelectCustom] = useState(false);

  const [checkedFixedMode, setCheckedFixedMode] = useState(
    defaultFixedModeOnCurrentChain,
  );

  useEffect(() => {
    if (
      (selectedGas && selectedGas?.level !== 'custom') ||
      (selectedGas?.level === 'custom' && !selectedGas.price)
    ) {
      setCheckedFixedMode(false);
    }
  }, [selectedGas]);

  useEffect(() => {
    if (isSelectCustom && !customGas) {
      setCheckedFixedMode(false);
    }
  }, [isSelectCustom, customGas]);

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
        fixedMode: checkedFixedMode,
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

  const pressedConfirmRef = useRef(false);
  const handleModalConfirmGas = () => {
    pressedConfirmRef.current = true;
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

  const handleClickEdit = useCallback(() => {
    setModalVisible(true);
    modalRef.current?.expand();
    if (rawSelectedGas?.level !== 'custom') {
      setSelectedGas(rawSelectedGas);
      setGasLimit(Number(gasLimit));
      setCustomNonce(Number(nonce));
      setIsSelectCustom(true);
      setCustomGas(undefined);
    }
    matomoRequestEvent({
      category: 'Transaction',
      action: 'EditGas',
      label: chain?.serverId,
    });
    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 50);
  }, [chain?.serverId, gasLimit, nonce, rawSelectedGas]);

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
        price: Number(customGas) * 1e9,
      });
    } else {
      setSelectedGas({
        ...gas,
        level: gas?.level,
      });
    }
  };

  const externalPanelSelection = useCallback(
    (gas: GasLevel) => {
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
          fixedMode: checkedFixedMode,
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
    },
    [
      checkedFixedMode,
      afterGasLimit,
      chainId,
      changedCustomGas,
      customNonce,
      gasList,
      isCancel,
      isSpeedUp,
      onChange,
    ],
  );

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
        if (customGas === undefined) return;
        loadCustomGasData(Number(customGas) * 1e9).then(data => {
          if (!data) {
            return;
          }
          if (data) setCustomGasEstimated(data.estimated_seconds);
          setSelectedGas(gas => ({
            ...gas,
            level: 'custom',
            price: Number(customGas) * 1e9,
            front_tx_count: 0,
            estimated_seconds: data?.estimated_seconds ?? 0,
            priority_price: gas?.priority_price ?? null,
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

  const isCustomLoading =
    isSelectCustom && !isNilCustomGas && loadingGasEstimated;

  const isCustomDisabled =
    isCustomLoading || (isSelectCustom && isNilCustomGas);

  useEffect(() => {
    if (!isReady || !selectedGas) {
      return;
    }

    // reset maxPriorityFee when user select custom gas and not input
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

    setMaxPriorityFee((prevFee = priorityPrice / 1e9) => {
      // Compare with selectedGas.price to avoid customMaxPriorityFee is more than maxGasFee
      if (hasCustomPriorityFee.current) {
        priorityPrice = Math.min(selectedGas.price, prevFee * 1e9);
      }
      return priorityPrice / 1e9;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasList, selectedGas, isReady, chainId, isSelectCustom, isNilCustomGas]);

  useEffect(() => {
    const customGas = gasList.find(item => item.level === 'custom');
    if (customGas) {
      setCustomGasEstimated(customGas.estimated_seconds);
    }
  }, [gasList]);

  const { colors, colors2024, styles } = useTheme2024({
    getStyle,
  });
  const modalRef = useRef<AppBottomSheetModal>(null);
  useEffect(() => {
    if (modalVisible) {
      modalRef.current?.present();
      pressedConfirmRef.current = false;
    } else {
      modalRef.current?.close();
    }
  }, [modalVisible]);

  const gasCostUsdStr = useMemo(() => {
    const bn = new BigNumber(modalExplainGas?.gasCostUsd);

    return formatGasHeaderUsdValue(bn.toString(10));
  }, [modalExplainGas?.gasCostUsd]);

  const gasCostAmountStr = useMemo(() => {
    return `${formatTokenAmount(
      new BigNumber(modalExplainGas.gasCostAmount).toString(10),
      6,
      true,
    )} ${chain?.nativeTokenSymbol}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalExplainGas?.gasCostAmount]);

  const [isGasHovering, setIsGasHovering] = useState(false);

  const [isGasAccountHovering, setIsGasAccountHovering] = useState(false);

  const handleClosePopup = () => {
    if (pressedConfirmRef.current) {
      return;
    }
    setCustomGas(e =>
      rawSelectedGas?.level === 'custom'
        ? Number(e) * 1e9 === rawSelectedGas.price
          ? e
          : rawSelectedGas.price / 1e9
        : undefined,
    );
    setChangedCustomGas(false);
    setSelectedGas(rawSelectedGas);
    setModalVisible(false);
  };

  const hasTip = isReal1559 && isHardware;
  const hasFee = is1559;
  const snapPoint = React.useMemo(() => {
    let v = 500 + (fixedMode ? 30 : 0);
    if (hasTip) {
      v += 50;
    }
    if (hasFee) {
      v += 100;
    }
    return v;
  }, [hasFee, hasTip, fixedMode]);

  const setGasInfoByUI = useSetGasInfoByUI();

  useThrottleEffect(
    () => {
      if (
        isFirstTimeLoad ||
        disabled ||
        !isReady ||
        !selectedGas ||
        !directSubmit
      ) {
        setGasInfoByUI(undefined);
        return;
      }
      setGasInfoByUI({
        externalPanelSelection,
        handleClickEdit,
        // gasList,
        gasCostUsdStr,
        gasUsdList: {
          slow: formatGasHeaderUsdValue(new BigNumber(gasSlowUsd).toString(10)),
          normal: formatGasHeaderUsdValue(
            new BigNumber(gasNormalUsd).toString(10),
          ),
          fast: formatGasHeaderUsdValue(new BigNumber(gasFastUsd).toString(10)),
        },
        gasIsNotEnough,
        gasAccountIsNotEnough,
        gasAccountCost: gasAccountCost?.gas_account_cost,
      });
    },
    [
      // externalPanelSelection,
      gasAccountIsNotEnough,
      gasIsNotEnough,
      directSubmit,
      isReady,
      isFirstTimeLoad,
      disabled,
      selectedGas,
      externalPanelSelection,
      handleClickEdit,
      gasCostUsdStr,
      gasSlowUsd,
      gasNormalUsd,
      gasFastUsd,
      gasAccountCost?.gas_account_cost,
      setGasInfoByUI,
    ],
    {
      wait: 16,
    },
  );

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
          activeOpacity={1}
          style={StyleSheet.flatten([
            styles.gasView,
            !gasMethod && { maxWidth: 220 },
          ])}>
          {gasMethod ? (
            <View
              style={{
                flexDirection: 'row',
                padding: 2,
                borderRadius: 6,
                borderWidth: 0.5,
                borderStyle: 'solid',
                borderColor: colors['neutral-line'],
                marginRight: 12,
                pointerEvents: isDisabledGasPopup ? 'none' : undefined,
              }}>
              <GasMethod
                active={gasMethod === 'native'}
                onChange={() => {
                  onChangeGasMethod?.('native');
                }}
                ActiveComponent={RcIconGasActive}
                BlurComponent={RcIconGasBlurCC}
                tips={t('page.signTx.nativeTokenForGas', {
                  tokenName: chain.nativeTokenSymbol,
                  chainName: chain.name,
                })}
              />

              <GasMethod
                active={gasMethod === 'gasAccount'}
                onChange={() => {
                  onChangeGasMethod?.('gasAccount');
                }}
                ActiveComponent={RcIconGasAccountActive}
                BlurComponent={RcIconGasAccountBlurCC}
                tips={t('page.signTx.gasAccountForGas')}
              />
            </View>
          ) : (
            <GasLogoSVG
              color={colors['neutral-foot']}
              style={StyleSheet.flatten({
                flexShrink: 0,
              })}
            />
          )}

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
            ) : gasMethod === 'gasAccount' ? (
              <View style={styles.gasSelectorCardContentItem}>
                <View style={[styles.gasSelectorCardAmount]}>
                  <Pressable
                    onPress={() => {
                      setIsGasAccountHovering(true);
                    }}>
                    <Text numberOfLines={1}>
                      <Text
                        style={[
                          styles.gasSelectorCardAmountLabelUsd,
                          !gasAccountCost?.balance_is_enough && {
                            color: colors2024['red-default'],
                          },
                        ]}>
                        {formatGasHeaderUsdValue(
                          (gasAccountCost?.gas_account_cost.estimate_tx_cost ||
                            0) +
                            (gasAccountCost?.gas_account_cost.gas_cost || 0),
                        )}
                      </Text>
                      <Text style={styles.gasSelectorCardAmountLabelAmount}>
                        {' '}
                        ~
                        {calcGasAccountUsd(
                          (gasAccountCost?.gas_account_cost.estimate_tx_cost ||
                            0) +
                            (gasAccountCost?.gas_account_cost.gas_cost || 0),
                        )?.replace('$', '')}{' '}
                        USD
                      </Text>
                    </Text>
                  </Pressable>
                  <Tip
                    isVisible={isGasAccountHovering}
                    onClose={() => {
                      setIsGasAccountHovering(false);
                    }}
                    content={
                      <View
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}>
                        <View>
                          <Text style={styles.gasAccountTip}>
                            {t('page.signTx.gasAccount.description')}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.gasAccountTip}>
                            {t('page.signTx.gasAccount.estimatedGas')}{' '}
                            {calcGasAccountUsd(
                              gasAccountCost?.gas_account_cost
                                .estimate_tx_cost || 0,
                            )}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.gasAccountTip}>
                            {t('page.signTx.gasAccount.maxGas')}{' '}
                            {calcGasAccountUsd(
                              gasAccountCost?.gas_account_cost.total_cost ||
                                '0',
                            )}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.gasAccountTip}>
                            {t('page.signTx.gasAccount.sendGas')}{' '}
                            {calcGasAccountUsd(
                              gasAccountCost?.gas_account_cost.total_cost ||
                                '0',
                            )}
                          </Text>
                        </View>

                        <View>
                          <Text style={styles.gasAccountTip}>
                            {t('page.signTx.gasAccount.gasCost')}{' '}
                            {calcGasAccountUsd(
                              gasAccountCost?.gas_account_cost.gas_cost || '0',
                            )}
                          </Text>
                        </View>
                      </View>
                    }>
                    <View>
                      <RcIconInfoCC
                        onPress={() => {
                          setIsGasAccountHovering(true);
                        }}
                        style={{ marginLeft: 4 }}
                        width={16}
                        height={16}
                        color={colors['neutral-body']}
                      />
                    </View>
                  </Tip>
                </View>
              </View>
            ) : (
              <View style={styles.gasSelectorCardContentItem}>
                <View style={styles.gasSelectorCardAmount}>
                  {gasMethod ? (
                    <Text
                      numberOfLines={1}
                      style={StyleSheet.flatten([
                        styles.gasSelectorCardAmountLabel,
                        !processedRules.includes('1118') &&
                        engineResultMap['1118']?.level === 'danger'
                          ? { color: colors2024['red-default'] }
                          : {},
                        !processedRules.includes('1118') &&
                        engineResultMap['1118']?.level === 'warning'
                          ? { color: colors2024['orange-default'] }
                          : {},
                      ])}>
                      <Text
                        style={[
                          styles.gasSelectorCardAmountLabelUsd,
                          gasMethod === 'native' &&
                            nativeTokenInsufficient && {
                              color: colors2024['red-default'],
                            },
                        ]}>
                        {gasCostUsdStr}
                      </Text>
                      <Text style={styles.gasSelectorCardAmountLabelAmount}>
                        {` ~${gasCostAmountStr}`}
                      </Text>
                    </Text>
                  ) : (
                    <Text
                      style={StyleSheet.flatten([
                        styles.gasSelectorCardAmountLabel,
                        !processedRules.includes('1118') &&
                        engineResultMap['1118']?.level === 'danger'
                          ? { color: colors2024['red-default'] }
                          : {},
                        !processedRules.includes('1118') &&
                        engineResultMap['1118']?.level === 'warning'
                          ? { color: colors2024['orange-default'] }
                          : {},
                      ])}>
                      {gasMethod ? (
                        <Text style={{ color: colors2024['brand-default'] }}>
                          {gasCostAmountStr}
                        </Text>
                      ) : (
                        gasCostUsdStr
                      )}
                    </Text>
                  )}

                  {chain.needEstimateGas &&
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

          {!gasMethod && gas.success ? (
            <Text style={styles.gasCostAmount}>
              {isGasHovering
                ? calcGasEstimated(selectedGas?.estimated_seconds)
                : `~${gasCostAmountStr}`}
            </Text>
          ) : null}
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
          disabled={isDisabledGasPopup}
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
          backgroundColor: colors['neutral-bg1'],
        }}
        onDismiss={handleClosePopup}>
        <BottomSheetScrollView
          style={styles.modalWrap}
          onScrollBeginDrag={Keyboard.dismiss}>
          <AppBottomSheetModalTitle
            style={styles.sheetTitle}
            title={t('page.signTx.gasSetting')}
          />
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
                <View style={styles.gasPriceDescDot} />
                <Text>
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
                </Text>
              </View>
              {gasPriceMedian !== null && (
                <View style={styles.gasPriceDescItem}>
                  <View style={styles.gasPriceDescDot} />
                  <Text>
                    <Text style={[styles.gasPriceDescText]}>
                      {t('page.signTx.gasPriceMedian')}
                    </Text>
                    <Text style={styles.gasPriceDescBoldText}>
                      {new BigNumber(gasPriceMedian).div(1e9).toFixed()} Gwei
                    </Text>
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
                onPress={() => {
                  setCheckedFixedMode(e => !e);
                }}>
                <CheckBoxRect checked={checkedFixedMode} />
                <Text style={styles.fixedModeText}>
                  {t('page.miniSignFooterBar.fixedModeText')}
                </Text>
              </Pressable>
            ) : null}

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
            disabled={
              !isReady ||
              validateStatus.customGas.status === 'error' ||
              isCustomDisabled
            }
            loading={isCustomLoading}
            title={t('global.confirm')}
          />
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </>
  );
};

const GasMethod = (props: {
  active: boolean;
  onChange: () => void;
  ActiveComponent: React.FC<SvgProps>;
  BlurComponent: React.FC<SvgProps>;
  tips?: React.ReactNode;
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
      onPress={onChange}>
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
