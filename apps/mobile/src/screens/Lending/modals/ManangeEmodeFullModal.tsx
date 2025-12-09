import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import AutoLockView from '@/components/AutoLockView';
import { Button } from '@/components2024/Button';
import { useMode } from '../hooks/useMode';
import ManageEmodeOverView from '../components/overviews/ManageEmodeOverView';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { last, noop } from 'lodash';
import {
  usePoolDataProviderContract,
  useRefreshHistoryId,
  useSelectedMarket,
} from '../hooks';
import { useSignatureStore } from '@/components2024/MiniSignV2';
import { buildManageEmodeTx } from '../poolService';
import { toast } from '@/components2024/Toast';
import { useMiniSigner } from '@/hooks/useSigner';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { useTranslation } from 'react-i18next';
import { apiProvider } from '@/core/apis';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { transactionHistoryService } from '@/core/services';

const ManageEmodeFullModal = ({ onClose }: { onClose: () => void }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { emodeEnabled, emodeCategoryId } = useMode();
  const { chainInfo } = useSelectedMarket();
  const { ctx } = useSignatureStore();
  const { refresh } = useRefreshHistoryId();

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

  const hasChangeCategory = useMemo(() => {
    return selectedCategoryId !== emodeCategoryId;
  }, [selectedCategoryId, emodeCategoryId]);

  const [isLoading, setIsLoading] = useState(false);
  const { openDirect, prefetch: prefetchMiniSigner } = useMiniSigner({
    account: currentAccount!,
    chainServerId: manageEmodeTx?.length
      ? manageEmodeTx?.[0]?.chainId + ''
      : '',
    autoResetGasStoreOnChainChange: true,
  });

  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );

  const buildTx = useCallback(async () => {
    if (!currentAccount || !pools || !chainInfo || !hasChangeCategory) {
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
    chainInfo,
    currentAccount,
    pools,
    selectedCategoryId,
    wantDisableEmode,
    hasChangeCategory,
  ]);

  useEffect(() => {
    buildTx();
  }, [buildTx]);

  useEffect(() => {
    if (currentAccount && canShowDirectSubmit && hasChangeCategory) {
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

  return (
    <AutoLockView as="View" style={styles.container}>
      <Text style={styles.title}>{t('page.Lending.manageEmode.title')}</Text>
      {wantDisableEmode ? null : (
        <Text style={styles.description}>
          {t('page.Lending.manageEmode.description')}
        </Text>
      )}
      <ManageEmodeOverView
        selectedCategoryId={
          wantDisableEmode ? emodeCategoryId : selectedCategoryId
        }
        disabled={wantDisableEmode}
        onSelectCategory={setSelectedCategoryId}
      />
      {canShowDirectSubmit && hasChangeCategory && (
        <View style={styles.gasPreContainer}>
          <DirectSignGasInfo
            supportDirectSign={true}
            loading={isLoading}
            openShowMore={noop}
            chainServeId={chainInfo?.serverId || ''}
          />
        </View>
      )}
      <View style={styles.buttonContainer}>
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
            titleStyle={wantDisableEmode ? styles.disableBtnTitle : undefined}
            buttonStyle={wantDisableEmode ? styles.disableBtn : undefined}
            title={
              wantDisableEmode
                ? t('page.Lending.manageEmode.actions.disable')
                : t('page.Lending.manageEmode.actions.enable')
            }
            iconColor={
              wantDisableEmode ? colors2024['neutral-title-1'] : undefined
            }
            onFinished={() => handlePressManageEMode()}
            disabled={
              !hasChangeCategory ||
              !manageEmodeTx ||
              !manageEmodeTx?.length ||
              isLoading ||
              !currentAccount ||
              !!ctx?.disabledProcess
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
            onPress={() => handlePressManageEMode()}
            title={
              wantDisableEmode
                ? t('page.Lending.manageEmode.actions.disable')
                : t('page.Lending.manageEmode.actions.enable')
            }
            titleStyle={wantDisableEmode ? styles.disableBtnTitle : undefined}
            loading={isLoading}
            disabled={isLoading || !currentAccount || !hasChangeCategory}
          />
        )}
      </View>
    </AutoLockView>
  );
};

export default ManageEmodeFullModal;

const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingHorizontal: 25,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
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
    height: 116,
    paddingTop: 12,
    marginTop: 'auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  directSignBtn: {
    width: '100%',
  },
  fullWidthButton: {
    flex: 1,
  },
  disableBtnTitle: {
    color: ctx.colors2024['neutral-title-1'],
  },
  disableBtn: {
    backgroundColor: ctx.colors2024['neutral-line'],
  },
}));
