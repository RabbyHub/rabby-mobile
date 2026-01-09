import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { atom, useAtom } from 'jotai';
import { DisplayPoolReserveInfo } from '../type';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { createGetStyles2024 } from '@/utils/styles';
import ToggleCollateralOverView from '../components/actions/ToggleCollateralOverView';
import { calculateHFAfterToggleCollateral } from '../utils/hfUtils';
import { collateralSwitchTx, optimizedPath } from '../poolService';
import {
  useHasUserSummary,
  useLendingRemoteData,
  useLendingSummary,
  usePoolDataProviderContract,
  useRefreshHistoryId,
  useSelectedMarket,
} from '../hooks';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { Button } from '@/components2024/Button';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useMiniSigner } from '@/hooks/useSigner';
import { toast } from '@/components2024/Toast';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import {
  MINI_SIGN_ERROR,
  useSignatureStore,
} from '@/components2024/MiniSignV2/state/SignatureManager';
import { apiProvider } from '@/core/apis';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { last, noop } from 'lodash';
import { transactionHistoryService } from '@/core/services';
import {
  API_ETH_MOCK_ADDRESS,
  HF_RISK_CHECKBOX_THRESHOLD,
} from '../utils/constant';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import IconCloseCC from '@/assets2024/icons/common/close-cc.svg';
import { useCurrentRouteName } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { useCollateralWaring } from '../hooks/useCollateralWaring';

export const toggleCollateralModalAtom = atom(false);
export const currentToggleReserveAtom = atom<DisplayPoolReserveInfo | null>(
  null,
);

export const useToggleCollateralModal = () => {
  const [, setIsShowToggleCollateralModal] = useAtom(toggleCollateralModalAtom);
  const [, setCurrentToggleReserve] = useAtom(currentToggleReserveAtom);
  const openCollateralChange = useCallback(
    (reserve: DisplayPoolReserveInfo) => {
      setIsShowToggleCollateralModal(true);
      setCurrentToggleReserve(reserve);
    },
    [setIsShowToggleCollateralModal, setCurrentToggleReserve],
  );
  return {
    openCollateralChange,
  };
};

function ToggleCollateralContent({}: {}) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [isShowToggleCollateralModal, setIsShowToggleCollateralModal] = useAtom(
    toggleCollateralModalAtom,
  );
  const [isLoading, setIsLoading] = useState(false);
  const { pools } = usePoolDataProviderContract();
  const [currentToggleReserve] = useAtom(currentToggleReserveAtom);

  const { userReserves, reserves } = useLendingRemoteData();
  const { wrapperPoolReserve, iUserSummary: userSummary } = useLendingSummary();
  const { selectedMarketData, chainInfo } = useSelectedMarket();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });
  const { refresh } = useRefreshHistoryId();
  const [isChecked, setIsChecked] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);

  const { openDirect, prefetch: prefetchMiniSigner } = useMiniSigner({
    account: currentAccount!,
    chainServerId: txs.length ? txs?.[0]?.chainId + '' : '',
    autoResetGasStoreOnChainChange: true,
  });
  const { ctx } = useSignatureStore();

  const afterHF = useMemo(() => {
    if (!currentToggleReserve || !userSummary) {
      return undefined;
    }
    return calculateHFAfterToggleCollateral(
      userSummary,
      currentToggleReserve,
    ).toString(10);
  }, [userSummary, currentToggleReserve]);

  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );

  const isRisky = useMemo(() => {
    if (!afterHF || Number(afterHF) < 0) {
      return false;
    }
    return Number(afterHF) < HF_RISK_CHECKBOX_THRESHOLD;
  }, [afterHF]);

  const isRiskToLiquidation = useMemo(() => {
    if (!afterHF || Number(afterHF) < 0) {
      return false;
    }
    return Number(afterHF) <= 1;
  }, [afterHF]);

  const showRisk = useMemo(() => {
    //如果面临清算就不让用户继续操作
    return isRisky && !isRiskToLiquidation;
  }, [isRisky, isRiskToLiquidation]);

  const isNativeToken = useMemo(() => {
    return isSameAddress(
      currentToggleReserve?.underlyingAsset || '',
      API_ETH_MOCK_ADDRESS,
    );
  }, [currentToggleReserve?.underlyingAsset]);

  const poolReserve = useMemo(() => {
    return reserves?.reservesData?.find(item =>
      isSameAddress(
        item.underlyingAsset,
        isNativeToken
          ? wrapperPoolReserve?.underlyingAsset || ''
          : currentToggleReserve?.underlyingAsset || '',
      ),
    );
  }, [
    currentToggleReserve?.underlyingAsset,
    isNativeToken,
    reserves?.reservesData,
    wrapperPoolReserve?.underlyingAsset,
  ]);

  const { isError, errorMessage } = useCollateralWaring({
    afterHF,
    userReserve: currentToggleReserve,
    poolReserve,
  });

  const buildTx = useCallback(async () => {
    if (
      !currentToggleReserve ||
      !currentAccount ||
      !pools ||
      !chainInfo ||
      isRiskToLiquidation ||
      isError ||
      !isShowToggleCollateralModal
    ) {
      setTxs([]);
      return;
    }
    const targetPool = userReserves?.userReserves?.find(item =>
      isSameAddress(
        item.underlyingAsset,
        isNativeToken
          ? wrapperPoolReserve?.underlyingAsset || ''
          : currentToggleReserve?.underlyingAsset || '',
      ),
    );

    if (!targetPool) {
      return;
    }
    try {
      const collateralSwitchResult = await collateralSwitchTx({
        pool: pools.pool,
        address: currentAccount.address,
        reserve: targetPool.underlyingAsset,
        usageAsCollateral: !targetPool.usageAsCollateralEnabledOnUser,
        useOptimizedPath: optimizedPath(selectedMarketData?.chainId),
      });
      const _txs = await Promise.all(collateralSwitchResult.map(i => i.tx()));
      const formatTxs = _txs.map(item => {
        delete item.gasLimit;
        return {
          ...item,
          chainId: chainInfo.id,
        };
      });
      setTxs(formatTxs as unknown as Tx[]);
    } catch (error) {
      console.error('There was some error', error);
    }
  }, [
    chainInfo,
    currentAccount,
    currentToggleReserve,
    isNativeToken,
    isRiskToLiquidation,
    isError,
    isShowToggleCollateralModal,
    pools,
    selectedMarketData?.chainId,
    userReserves?.userReserves,
    wrapperPoolReserve?.underlyingAsset,
  ]);

  useEffect(() => {
    buildTx();
  }, [buildTx]);

  const btnTitle = useMemo(() => {
    return currentToggleReserve?.usageAsCollateralEnabledOnUser
      ? t('page.Lending.toggleCollateralDetail.disable', {
          asset: currentToggleReserve?.reserve.symbol,
        })
      : t('page.Lending.toggleCollateralDetail.enable', {
          asset: currentToggleReserve?.reserve.symbol,
        });
  }, [
    currentToggleReserve?.usageAsCollateralEnabledOnUser,
    t,
    currentToggleReserve?.reserve.symbol,
  ]);

  const title = useMemo(() => {
    if (currentToggleReserve?.reserve.isIsolated) {
      return currentToggleReserve?.usageAsCollateralEnabledOnUser
        ? t('page.Lending.toggleCollateralModal.exitIsolationModeTitle')
        : t('page.Lending.toggleCollateralModal.enableIsolationModeTitle');
    }
    return currentToggleReserve?.usageAsCollateralEnabledOnUser
      ? t('page.Lending.toggleCollateralModal.closeTitle')
      : t('page.Lending.toggleCollateralModal.openTitle');
  }, [
    currentToggleReserve?.reserve.isIsolated,
    currentToggleReserve?.usageAsCollateralEnabledOnUser,
    t,
  ]);

  const cardColors = useMemo(() => {
    const isIsolated = currentToggleReserve?.reserve.isIsolated;
    return {
      bgColor: isIsolated
        ? colors2024['neutral-bg-5']
        : colors2024['orange-light-1'],
      textColor: isIsolated
        ? colors2024['neutral-foot']
        : colors2024['orange-default'],
      iconColor: isIsolated
        ? colors2024['neutral-secondary']
        : colors2024['orange-default'],
    };
  }, [colors2024, currentToggleReserve?.reserve.isIsolated]);

  const desc = useMemo(() => {
    if (currentToggleReserve?.reserve.isIsolated) {
      return currentToggleReserve?.usageAsCollateralEnabledOnUser
        ? t('page.Lending.toggleCollateralModal.exitIsolationModeDesc')
        : t('page.Lending.toggleCollateralModal.enableIsolationModeDesc');
    }
    if (currentToggleReserve?.usageAsCollateralEnabledOnUser) {
      if (userSummary?.totalBorrowsUSD === '0') {
        return '';
      }
      return t('page.Lending.toggleCollateralModal.closeDesc');
    } else {
      return t('page.Lending.toggleCollateralModal.openDesc');
    }
  }, [
    currentToggleReserve?.reserve.isIsolated,
    currentToggleReserve?.usageAsCollateralEnabledOnUser,
    t,
    userSummary?.totalBorrowsUSD,
  ]);

  const handleToggleCollateral = useCallback(
    async (forceFullSign?: boolean) => {
      if (!currentAccount || !txs.length) {
        return;
      }

      try {
        setIsLoading(true);
        if (!txs?.length) {
          toast.info('please retry');
          throw new Error('no txs');
        }
        let results: string[] = [];
        if (canShowDirectSubmit && !forceFullSign) {
          try {
            results = await openDirect({
              txs,
              ga: {
                customAction: CUSTOM_HISTORY_ACTION.LENDING,
                customActionTitleType:
                  currentToggleReserve?.usageAsCollateralEnabledOnUser
                    ? CUSTOM_HISTORY_TITLE_TYPE.LENDING_OFF_COLLATERAL
                    : CUSTOM_HISTORY_TITLE_TYPE.LENDING_ON_COLLATERAL,
              },
            });
          } catch (error) {
            if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
              setIsShowToggleCollateralModal(false);
              return;
            }
            if (error === MINI_SIGN_ERROR.PREFETCH_FAILURE) {
              handleToggleCollateral(true);
              return;
            }
            toast.error(t('page.Lending.toggleCollateralDetail.error'));
            setIsShowToggleCollateralModal(true);
            return;
          }
        } else {
          setIsShowToggleCollateralModal(false);
          for (const tx of txs) {
            const result = await apiProvider.sendRequest({
              data: {
                method: 'eth_sendTransaction',
                params: [tx],
                $ctx: {
                  ga: {
                    customAction: CUSTOM_HISTORY_ACTION.LENDING,
                    customActionTitleType:
                      currentToggleReserve?.usageAsCollateralEnabledOnUser
                        ? CUSTOM_HISTORY_TITLE_TYPE.LENDING_OFF_COLLATERAL
                        : CUSTOM_HISTORY_TITLE_TYPE.LENDING_ON_COLLATERAL,
                  },
                },
              },
              session: INTERNAL_REQUEST_SESSION,
              account: currentAccount,
            });
            results.push(result);
          }
        }

        const txId = last(results);
        if (txId && txs[0]) {
          transactionHistoryService.setCustomTxItem(
            currentAccount.address,
            txs[0].chainId,
            txId,
            {
              actionType: currentToggleReserve?.usageAsCollateralEnabledOnUser
                ? CUSTOM_HISTORY_TITLE_TYPE.LENDING_OFF_COLLATERAL
                : CUSTOM_HISTORY_TITLE_TYPE.LENDING_ON_COLLATERAL,
            },
          );
        }
        refresh();
        toast.success(`${btnTitle} ${t('page.Lending.submitted')}`);
        setIsShowToggleCollateralModal(false);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentAccount,
      txs,
      canShowDirectSubmit,
      refresh,
      btnTitle,
      t,
      setIsShowToggleCollateralModal,
      openDirect,
      currentToggleReserve?.usageAsCollateralEnabledOnUser,
    ],
  );

  useEffect(() => {
    if (
      currentAccount &&
      canShowDirectSubmit &&
      !isRiskToLiquidation &&
      !isError &&
      isShowToggleCollateralModal
    ) {
      prefetchMiniSigner({
        txs: txs?.length ? txs : [],
        synGasHeaderInfo: true,
      });
    }
  }, [
    canShowDirectSubmit,
    currentAccount,
    isRiskToLiquidation,
    isError,
    isShowToggleCollateralModal,
    prefetchMiniSigner,
    txs,
  ]);

  const RiskContent = useMemo(() => {
    if (isError) {
      return <Text style={styles.riskToLiquidationText}>{errorMessage}</Text>;
    }
    if (isRiskToLiquidation) {
      return (
        <Text style={styles.riskToLiquidationText}>
          {t('page.Lending.toggleCollateralModal.riskToLiquidationText')}
        </Text>
      );
    }
    if (showRisk) {
      return (
        <>
          <View style={styles.warningContainer}>
            <RcIconWarningCircleCC
              width={15}
              height={15}
              color={colors2024['red-default']}
            />
            <Text style={styles.warningText}>
              {t('page.Lending.risk.toggleCollateralWarning')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => {
              setIsChecked(prev => !prev);
            }}>
            <CheckBoxRect size={16} checked={isChecked} />
            <Text style={styles.checkboxText}>
              {t('page.Lending.risk.checkbox')}
            </Text>
          </TouchableOpacity>
        </>
      );
    }
    return null;
  }, [
    isError,
    isRiskToLiquidation,
    showRisk,
    styles,
    errorMessage,
    t,
    colors2024,
    isChecked,
  ]);

  if (!isShowToggleCollateralModal) {
    return null;
  }
  return (
    <View style={styles.modal}>
      <View
        style={styles.overlay}
        onTouchEnd={() => setIsShowToggleCollateralModal(false)}>
        <View style={[styles.container]} onTouchEnd={e => e.stopPropagation()}>
          <View style={styles.closeButton}>
            <TouchableOpacity
              onPress={() => setIsShowToggleCollateralModal(false)}>
              <IconCloseCC
                width={20}
                height={20}
                color={colors2024['neutral-foot']}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {!!desc && (
              <View
                style={[
                  styles.errorMessageContainer,
                  {
                    backgroundColor: cardColors.bgColor,
                  },
                ]}>
                <RcIconWarningCircleCC
                  width={15}
                  height={15}
                  color={cardColors.iconColor}
                />
                <Text
                  style={[
                    styles.errorMessage,
                    {
                      color: cardColors.textColor,
                    },
                  ]}>
                  {desc}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.bodyContainer}>
            {!!currentToggleReserve && userSummary && (
              <ToggleCollateralOverView
                reserve={currentToggleReserve}
                afterHF={afterHF}
                userSummary={userSummary}
              />
            )}
            {!!txs.length &&
              canShowDirectSubmit &&
              !isRiskToLiquidation &&
              !isError && (
                <View style={styles.gasPreContainer}>
                  <DirectSignGasInfo
                    supportDirectSign={true}
                    loading={isLoading}
                    openShowMore={noop}
                    chainServeId={chainInfo?.serverId || ''}
                  />
                </View>
              )}
          </View>
          {RiskContent}
          <View style={styles.btnContainer}>
            {canShowDirectSubmit ? (
              <DirectSignBtn
                loading={isLoading}
                loadingType="circle"
                key={`${currentToggleReserve?.underlyingAsset}`}
                showTextOnLoading
                wrapperStyle={styles.directSignBtn}
                authTitle={btnTitle}
                title={btnTitle}
                titleStyle={styles.directSignBtnTitle}
                onFinished={() => handleToggleCollateral()}
                disabled={
                  !txs.length ||
                  isLoading ||
                  !currentAccount ||
                  !!ctx?.disabledProcess ||
                  (isRisky && !isChecked) ||
                  isRiskToLiquidation ||
                  isError
                }
                type="primary"
                syncUnlockTime
                account={currentAccount}
                showHardWalletProcess
              />
            ) : (
              <Button
                loadingType="circle"
                showTextOnLoading
                containerStyle={styles.fullWidthButton}
                onPress={() => handleToggleCollateral()}
                title={btnTitle}
                loading={isLoading}
                disabled={
                  !txs.length ||
                  isLoading ||
                  !currentAccount ||
                  (isRisky && !isChecked) ||
                  isRiskToLiquidation ||
                  isError
                }
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export const ToggleCollateralModal = () => {
  const { hasUserSummary } = useHasUserSummary();
  const { currentRouteName } = useCurrentRouteName();
  const isLendingRoute = currentRouteName === RootNames.Lending;
  if (!hasUserSummary || !isLendingRoute) {
    return null;
  }
  return <ToggleCollateralContent />;
};

const ScreenWidth = Dimensions.get('screen').width;
const ScreenHeight = Dimensions.get('screen').height;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  modal: {
    width: ScreenWidth,
    height: ScreenHeight,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  container: {
    maxWidth: 350,
    width: '100%',
    marginHorizontal: 20,
    backgroundColor: colors2024['neutral-bg-0'],
    paddingTop: 37,
    borderRadius: 16,
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    textAlign: 'center',
  },
  header: {
    paddingLeft: 15,
    paddingRight: 16,
  },
  closeButton: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    position: 'absolute',
    top: 20,
    right: 20,
  },
  bodyContainer: {
    width: '100%',
    paddingLeft: 15,
    paddingRight: 16,
  },
  body: {
    paddingHorizontal: 20,
    marginTop: 12,
    fontSize: 14,
    color: colors2024['neutral-body'],
    textAlign: 'center',
  },
  btnContainer: {
    marginTop: 16,
    marginBottom: 32,
    //flex: 1,
    //height: 50,
    width: '100%',
    paddingHorizontal: 16,
  },

  errorMessageContainer: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors2024['orange-light-1'],
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 16,
    width: '100%',
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    width: '100%',
    flex: 1,
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro Rounded',
  },
  directSignBtnTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  directSignBtn: {
    width: '100%',
  },
  warningContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors2024['red-light-1'],
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 8,
    marginLeft: 16,
    marginRight: 16,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flex: 1,
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
  checkbox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  checkboxText: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  fullWidthButton: {
    flex: 1,
    paddingBottom: 58,
  },
  gasPreContainer: {
    paddingHorizontal: 8,
    marginTop: 8,
  },
  riskToLiquidationText: {
    marginTop: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
}));
