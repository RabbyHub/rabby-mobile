import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { last, noop } from 'lodash';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { apiProvider } from '@/core/apis';
import { useTheme2024 } from '@/hooks/theme';
import { toast } from '@/components2024/Toast';
import { Button } from '@/components2024/Button';
import { useMiniSigner } from '@/hooks/useSigner';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { transactionHistoryService } from '@/core/services';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useSignatureStore } from '@/components2024/MiniSignV2';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';

import { useMode } from '../hooks/useMode';
import { buildManageEmodeTx } from '../poolService';
import ManageEmodeOverView from '../components/overviews/ManageEmodeOverView';
import {
  useLendingRemoteData,
  useLendingSummary,
  usePoolDataProviderContract,
  useRefreshHistoryId,
  useSelectedMarket,
} from '../hooks';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { formatUserSummary } from '@aave/math-utils';
import dayjs from 'dayjs';
import {
  HF_BLOCK_THRESHOLD,
  HF_RISK_CHECKBOX_THRESHOLD,
} from '../utils/constant';
import { isEModeCategoryAvailable } from '../utils/emode';

const BOTTOM_SIZE = {
  BUTTON: 116,
  CHECKBOX: 40,
  TIPS: 80,
};

const ManageEmodeFullModal = ({ onClose }: { onClose: () => void }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { emodeEnabled, emodeCategoryId, eModes } = useMode();
  const { chainInfo } = useSelectedMarket();
  const { ctx } = useSignatureStore();
  const { refresh } = useRefreshHistoryId();
  const [isChecked, setIsChecked] = useState(false);
  const { userReserves, reserves } = useLendingRemoteData();

  const { iUserSummary, formattedPoolReservesAndIncentives } =
    useLendingSummary();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });

  const { pools } = usePoolDataProviderContract();
  const [manageEmodeTx, setManageEmodeTx] = useState<any>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    emodeCategoryId || 0,
  );
  const wantDisableEmode = useMemo(() => {
    // 如果已经打开的话只能关闭，没有switch功能
    return emodeEnabled;
  }, [emodeEnabled]);

  const isTargetCategoryAvailable = useMemo(() => {
    const targetCategory = eModes[selectedCategoryId];
    return iUserSummary
      ? isEModeCategoryAvailable(iUserSummary, targetCategory)
      : false;
  }, [eModes, iUserSummary, selectedCategoryId]);

  const hasChangeCategory = useMemo(() => {
    return selectedCategoryId !== emodeCategoryId || wantDisableEmode;
  }, [selectedCategoryId, emodeCategoryId, wantDisableEmode]);

  const [isLoading, setIsLoading] = useState(false);
  const { openDirect, prefetch: prefetchMiniSigner } = useMiniSigner({
    account: currentAccount!,
    chainServerId: manageEmodeTx?.length
      ? manageEmodeTx?.[0]?.chainId + ''
      : '',
    autoResetGasStoreOnChainChange: true,
  });

  const newSummary = useMemo(() => {
    return formatUserSummary({
      currentTimestamp: dayjs().unix(),
      userReserves: userReserves?.userReserves || [],
      formattedReserves: formattedPoolReservesAndIncentives || [],
      userEmodeCategoryId: wantDisableEmode ? 0 : selectedCategoryId || 0,
      marketReferenceCurrencyDecimals:
        reserves?.baseCurrencyData?.marketReferenceCurrencyDecimals || 0,
      marketReferencePriceInUsd:
        reserves?.baseCurrencyData?.marketReferenceCurrencyPriceInUsd || 0,
    });
  }, [
    wantDisableEmode,
    formattedPoolReservesAndIncentives,
    reserves?.baseCurrencyData?.marketReferenceCurrencyDecimals,
    reserves?.baseCurrencyData?.marketReferenceCurrencyPriceInUsd,
    selectedCategoryId,
    userReserves?.userReserves,
  ]);

  const { isRisky, isBlock, desc } = useMemo(() => {
    if (Number(newSummary?.healthFactor || '0') <= 0) {
      return {
        isRisky: false,
        isBlock: false,
        desc: '',
      };
    }
    const _isRisky =
      Number(newSummary?.healthFactor || '0') < HF_RISK_CHECKBOX_THRESHOLD;
    const _isBlock =
      Number(newSummary?.healthFactor || '0') <= HF_BLOCK_THRESHOLD;
    return {
      isRisky: _isRisky,
      isBlock: _isBlock,
      desc: _isBlock
        ? t('page.Lending.risk.blockEmodeWarning')
        : _isRisky
        ? t('page.Lending.risk.emodeBlockWarning')
        : '',
    };
  }, [newSummary?.healthFactor, t]);

  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );

  const buildTx = useCallback(async () => {
    if (
      !currentAccount ||
      !pools ||
      !chainInfo ||
      !hasChangeCategory ||
      isBlock ||
      !isTargetCategoryAvailable
    ) {
      setManageEmodeTx(null);
      return;
    }
    try {
      const manageEmodeResult = await buildManageEmodeTx({
        pool: pools.pool,
        address: currentAccount.address,
        categoryId: wantDisableEmode ? 0 : selectedCategoryId,
      });
      const _txs = await Promise.all(manageEmodeResult.map(i => i.tx()));
      const formatTxs = _txs.map(item => {
        delete item.gasLimit;
        return {
          ...item,
          chainId: chainInfo.id,
        };
      });
      setManageEmodeTx(formatTxs);
    } catch (error) {
      toast.error('There was some error');
    }
  }, [
    currentAccount,
    pools,
    chainInfo,
    hasChangeCategory,
    isBlock,
    isTargetCategoryAvailable,
    wantDisableEmode,
    selectedCategoryId,
  ]);

  useEffect(() => {
    buildTx();
  }, [buildTx]);

  useEffect(() => {
    if (
      currentAccount &&
      canShowDirectSubmit &&
      hasChangeCategory &&
      !isBlock &&
      isTargetCategoryAvailable
    ) {
      prefetchMiniSigner({
        txs: manageEmodeTx?.length ? manageEmodeTx : [],
        synGasHeaderInfo: true,
      });
    }
  }, [
    canShowDirectSubmit,
    currentAccount,
    prefetchMiniSigner,
    manageEmodeTx,
    hasChangeCategory,
    isBlock,
    isTargetCategoryAvailable,
  ]);

  const handlePressManageEMode = useCallback(
    async (forceFullSign?: boolean) => {
      if (!currentAccount || !manageEmodeTx || !manageEmodeTx?.length) {
        return;
      }

      try {
        setIsLoading(true);
        if (!manageEmodeTx?.length) {
          toast.info('please retry');
        }
        let results: string[] = [];
        if (canShowDirectSubmit && !forceFullSign) {
          try {
            results = await openDirect({
              txs: manageEmodeTx,
              ga: {
                customAction: CUSTOM_HISTORY_ACTION.LENDING,
                customActionTitleType: wantDisableEmode
                  ? CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE_DISABLE
                  : CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE,
              },
            });
          } catch (error) {
            if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
              onClose?.();
              return;
            }
            if (error === MINI_SIGN_ERROR.PREFETCH_FAILURE) {
              handlePressManageEMode(true);
              return;
            }
            toast.error(t('page.Lending.toggleCollateralDetail.error'));
            return;
          }
        } else {
          for (const tx of manageEmodeTx) {
            const result = await apiProvider.sendRequest({
              data: {
                method: 'eth_sendTransaction',
                params: [tx],
                $ctx: {
                  ga: {
                    customAction: CUSTOM_HISTORY_ACTION.LENDING,
                    customActionTitleType: wantDisableEmode
                      ? CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE_DISABLE
                      : CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE,
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
        if (txId) {
          transactionHistoryService.setCustomTxItem(
            currentAccount.address,
            manageEmodeTx[0].chainId,
            txId,
            {
              actionType: wantDisableEmode
                ? CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE_DISABLE
                : CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE,
            },
          );
        }
        refresh();
        toast.success(
          `${
            wantDisableEmode
              ? t('page.Lending.manageEmode.actions.disable')
              : t('page.Lending.manageEmode.actions.enable')
          } ${t('page.Lending.submitted')}`,
        );
        onClose?.();
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentAccount,
      manageEmodeTx,
      canShowDirectSubmit,
      refresh,
      wantDisableEmode,
      t,
      onClose,
      openDirect,
    ],
  );

  const disableDirectSignBtn = useMemo(() => {
    return (
      !hasChangeCategory ||
      !manageEmodeTx ||
      !manageEmodeTx?.length ||
      isLoading ||
      !currentAccount ||
      !!ctx?.disabledProcess ||
      (isRisky && !isChecked) ||
      isBlock ||
      !isTargetCategoryAvailable
    );
  }, [
    hasChangeCategory,
    manageEmodeTx,
    isLoading,
    currentAccount,
    ctx?.disabledProcess,
    isRisky,
    isChecked,
    isBlock,
    isTargetCategoryAvailable,
  ]);

  const disableFullWidthButton = useMemo(() => {
    return (
      isLoading ||
      !currentAccount ||
      !hasChangeCategory ||
      isBlock ||
      (isRisky && !isChecked) ||
      !isTargetCategoryAvailable
    );
  }, [
    isLoading,
    currentAccount,
    hasChangeCategory,
    isBlock,
    isRisky,
    isChecked,
    isTargetCategoryAvailable,
  ]);

  return (
    <AutoLockView as="View" style={styles.container}>
      <BottomSheetScrollView
        showsVerticalScrollIndicator
        persistentScrollbar
        style={styles.scrollableBlock}
        contentContainerStyle={[styles.contentContainer]}>
        <Text style={styles.title}>
          {wantDisableEmode
            ? t('page.Lending.manageEmode.actions.disable')
            : t('page.Lending.manageEmode.title')}
        </Text>
        {wantDisableEmode ? null : (
          <Text style={styles.description}>
            {t('page.Lending.manageEmode.description')}
          </Text>
        )}
        <ManageEmodeOverView
          selectedCategoryId={
            wantDisableEmode ? emodeCategoryId : selectedCategoryId
          }
          newSummary={newSummary}
          disabled={wantDisableEmode}
          onSelectCategory={setSelectedCategoryId}
          isUnAvailable={!isTargetCategoryAvailable && !!selectedCategoryId}
        />
        {canShowDirectSubmit &&
          hasChangeCategory &&
          !isBlock &&
          isTargetCategoryAvailable && (
            <View style={styles.gasPreContainer}>
              <DirectSignGasInfo
                supportDirectSign={true}
                loading={false}
                openShowMore={noop}
                chainServeId={chainInfo?.serverId || ''}
              />
            </View>
          )}
      </BottomSheetScrollView>
      <View
        style={[
          styles.buttonContainer,
          {
            height:
              BOTTOM_SIZE.BUTTON +
              (isBlock
                ? BOTTOM_SIZE.TIPS
                : isRisky
                ? BOTTOM_SIZE.CHECKBOX + BOTTOM_SIZE.TIPS
                : 0),
          },
        ]}>
        {isRisky && (
          <>
            <View style={styles.warningContainer}>
              <RcIconWarningCircleCC
                width={15}
                height={15}
                color={colors2024['red-default']}
              />
              <Text style={styles.warningText}>{desc}</Text>
            </View>
            {isBlock ? null : (
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
            )}
          </>
        )}
        {canShowDirectSubmit ? (
          <DirectSignBtn
            loading={isLoading}
            loadingType="circle"
            key={wantDisableEmode ? 0 : selectedCategoryId}
            showTextOnLoading
            wrapperStyle={styles.directSignBtn}
            authTitle={
              wantDisableEmode
                ? t('page.Lending.manageEmode.actions.disable')
                : t('page.Lending.manageEmode.actions.enable')
            }
            titleStyle={[
              wantDisableEmode && styles.closeButtonTitle,
              wantDisableEmode &&
                disableDirectSignBtn &&
                styles.disableBtnTitle,
            ]}
            buttonStyle={wantDisableEmode ? styles.closeButton : undefined}
            title={
              wantDisableEmode
                ? t('page.Lending.manageEmode.actions.disable')
                : t('page.Lending.manageEmode.actions.enable')
            }
            iconColor={
              wantDisableEmode
                ? disableDirectSignBtn
                  ? colors2024['neutral-info']
                  : colors2024['neutral-title-1']
                : undefined
            }
            onFinished={() => handlePressManageEMode()}
            disabled={disableDirectSignBtn}
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
            onPress={() => handlePressManageEMode()}
            title={
              wantDisableEmode
                ? t('page.Lending.manageEmode.actions.disable')
                : t('page.Lending.manageEmode.actions.enable')
            }
            titleStyle={[
              wantDisableEmode && styles.closeButtonTitle,
              wantDisableEmode &&
                disableFullWidthButton &&
                styles.disableBtnTitle,
            ]}
            buttonStyle={wantDisableEmode ? styles.closeButton : undefined}
            loading={isLoading}
            disabled={disableFullWidthButton}
          />
        )}
      </View>
    </AutoLockView>
  );
};

export default ManageEmodeFullModal;

const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingBottom: 0,
    height: '100%',
    position: 'relative',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  scrollableBlock: {
    flex: 1,
    height: '100%',
  },
  contentContainer: {
    paddingHorizontal: 25,
    paddingBottom: 300,
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    position: 'absolute',
    bottom: 56,
    width: '100%',
  },
  disabledButton: {
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  disabledTitle: {
    color: ctx.colors2024['neutral-title-1'],
  },
  gasPreContainer: {
    paddingHorizontal: 8,
    marginTop: 12,
    width: '100%',
  },
  buttonContainer: {
    position: 'absolute',
    paddingHorizontal: 25,
    bottom: 0,
    height: 116,
    paddingTop: 12,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  directSignBtn: {
    width: '100%',
  },
  fullWidthButton: {
    flex: 1,
  },
  closeButtonTitle: {
    color: ctx.colors2024['neutral-title-1'],
  },
  disableBtnTitle: {
    color: ctx.colors2024['neutral-info'],
  },
  closeButton: {
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  checkbox: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxText: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-foot'],
  },
  warningContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: ctx.colors2024['red-light-1'],
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flex: 1,
    color: ctx.colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
}));
