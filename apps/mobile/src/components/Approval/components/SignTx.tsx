import { Button } from '@/components/Button';
import { Account, ChainGas } from '@/core/services/preference';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { CHAINS_ENUM } from '@debank/common';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';
import { Text, View } from 'react-native';
import { WaitingSignMessageComponent } from './map';

interface SignTxProps<TData extends any[] = any[]> {
  params: {
    session: {
      origin: string;
      icon: string;
      name: string;
    };
    data: TData;
    isGnosis?: boolean;
    account?: Account;
    $ctx?: any;
  };
  origin?: string;
}

const normalizeTxParams = tx => {
  const copy = tx;
  console.log('copy', tx);
  try {
    if ('nonce' in copy && isStringOrNumber(copy.nonce)) {
      copy.nonce = normalizeHex(copy.nonce);
    }
    if ('gas' in copy && isStringOrNumber(copy.gas)) {
      copy.gas = normalizeHex(copy.gas);
    }
    if ('gasLimit' in copy && isStringOrNumber(copy.gasLimit)) {
      copy.gas = normalizeHex(copy.gasLimit);
    }
    if ('gasPrice' in copy && isStringOrNumber(copy.gasPrice)) {
      copy.gasPrice = normalizeHex(copy.gasPrice);
    }
    if ('maxFeePerGas' in copy && isStringOrNumber(copy.maxFeePerGas)) {
      copy.maxFeePerGas = normalizeHex(copy.maxFeePerGas);
    }
    if (
      'maxPriorityFeePerGas' in copy &&
      isStringOrNumber(copy.maxPriorityFeePerGas)
    ) {
      copy.maxPriorityFeePerGas = normalizeHex(copy.maxPriorityFeePerGas);
    }
    if ('value' in copy) {
      if (!isStringOrNumber(copy.value)) {
        copy.value = '0x0';
      } else {
        copy.value = normalizeHex(copy.value);
      }
    }
    if ('data' in copy) {
      if (!tx.data.startsWith('0x')) {
        copy.data = `0x${tx.data}`;
      }
    }
  } catch (e) {
    Sentry.captureException(
      new Error(`normalizeTxParams failed, ${JSON.stringify(e)}`),
    );
  }
  return copy;
};

export const SignTx = ({ params }: SignTxProps) => {
  const [, resolveApproval, rejectApproval] = useApproval();
  const { currentAccount } = useCurrentAccount();
  const colors = useThemeColors();
  const [chainId, setChainId] = React.useState<number>(
    params.data[0].chainId && Number(params.data[0].chainId),
  );

  const {
    data = '0x',
    from,
    gas,
    gasPrice,
    nonce,
    to,
    value,
    maxFeePerGas,
    isSpeedUp,
    isCancel,
    isSend,
    isSwap,
    isViewGnosisSafe,
    reqId,
    safeTxGas,
  } = normalizeTxParams(params.data[0]);

  const [tx, setTx] = React.useState<Tx>({
    chainId,
    data: data || '0x', // can not execute with empty string, use 0x instead
    from,
    gas: gas || params.data[0].gasLimit,
    gasPrice: getGasPrice(),
    nonce,
    to,
    value,
  });

  const handleAllow = async () => {
    // TODO
    // if (activeApprovalPopup()) {
    //   return;
    // }

    // try {
    //   validateGasPriceRange(tx);
    // } catch (e) {
    //   Modal.error({
    //     title: 'Error',
    //     content: e.message || JSON.stringify(e),
    //   });
    //   return;
    // }

    // const selected: ChainGas = {
    //   lastTimeSelect: selectedGas.level === 'custom' ? 'gasPrice' : 'gasLevel',
    // };
    // if (selectedGas.level === 'custom') {
    //   if (support1559) {
    //     selected.gasPrice = parseInt(tx.maxFeePerGas!);
    //   } else {
    //     selected.gasPrice = parseInt(tx.gasPrice!);
    //   }
    // } else {
    //   selected.gasLevel = selectedGas.level;
    // }
    // if (!isSpeedUp && !isCancel && !isSwap) {
    //   await wallet.updateLastTimeGasSelection(chainId, selected);
    // }
    const transaction: Tx = {
      from: tx.from,
      to: tx.to,
      data: tx.data,
      nonce: tx.nonce,
      value: tx.value,
      chainId: tx.chainId,
      gas: '',
    };
    if (support1559) {
      transaction.maxFeePerGas = tx.maxFeePerGas;
      transaction.maxPriorityFeePerGas =
        maxPriorityFee <= 0
          ? tx.maxFeePerGas
          : intToHex(Math.round(maxPriorityFee));
    } else {
      (transaction as Tx).gasPrice = tx.gasPrice;
    }
    const approval = await getApproval();
    gaEvent('allow');

    approval.signingTxId &&
      (await wallet.updateSigningTx(approval.signingTxId, {
        rawTx: {
          nonce: realNonce || tx.nonce,
        },
        explain: {
          ...txDetail!,
          approvalId: approval.id,
          calcSuccess: !(checkErrors.length > 0),
        },
        action: {
          actionData,
          requiredData: actionRequireData,
        },
      }));

    if (currentAccount?.type && WaitingSignComponent[currentAccount.type]) {
      resolveApproval({
        ...transaction,
        isSend,
        nonce: realNonce || tx.nonce,
        gas: gasLimit,
        uiRequestComponent: WaitingSignComponent[currentAccount.type],
        type: currentAccount.type,
        address: currentAccount.address,
        traceId: txDetail?.trace_id,
        extra: {
          brandName: currentAccount.brandName,
        },
        $ctx: params.$ctx,
        signingTxId: approval.signingTxId,
        pushType: pushInfo.type,
        lowGasDeadline: pushInfo.lowGasDeadline,
        reqId,
      });

      return;
    }
    if (isGnosisAccount || isCoboArugsAccount) {
      setDrawerVisible(true);
      return;
    }

    await wallet.reportStats('signTransaction', {
      type: currentAccount.brandName,
      chainId: chain.serverId,
      category: KEYRING_CATEGORY_MAP[currentAccount.type],
      preExecSuccess:
        checkErrors.length > 0 || !txDetail?.pre_exec.success ? false : true,
      createBy: params?.$ctx?.ga ? 'rabby' : 'dapp',
      source: params?.$ctx?.ga?.source || '',
      trigger: params?.$ctx?.ga?.trigger || '',
    });

    matomoRequestEvent({
      category: 'Transaction',
      action: 'Submit',
      label: currentAccount.brandName,
    });
    resolveApproval({
      ...transaction,
      nonce: realNonce || tx.nonce,
      gas: gasLimit,
      isSend,
      traceId: txDetail?.trace_id,
      signingTxId: approval.signingTxId,
      pushType: pushInfo.type,
      lowGasDeadline: pushInfo.lowGasDeadline,
      reqId,
    });
  };

  return (
    <View>
      <Text
        style={{
          fontSize: 30,
        }}>
        SignText
      </Text>
      <Text>{JSON.stringify(params, null, ' ')}</Text>
      <Button
        onPress={handleAllow}
        title="Sign"
        titleStyle={{
          color: colors['neutral-title-2'],
        }}
        buttonStyle={{
          backgroundColor: colors['blue-default'],
          padding: 10,
        }}
      />
    </View>
  );
};
