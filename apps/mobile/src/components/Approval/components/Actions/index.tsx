import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Chain } from '@/constant/chains';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BalanceChange from '../TxComponents/BalanceChange';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import ApproveNFT from './ApproveNFT';
import ApproveNFTCollection from './ApproveNFTCollection';
import CancelTx from './CancelTx';
import ContractCall from './ContractCall';
import DeployContract from './DeployContract';
import RevokeNFT from './RevokeNFT';
import RevokeNFTCollection from './RevokeNFTCollection';
import Send from './Send';
import SendNFT from './SendNFT';
import Swap from './Swap';
import TokenApprove from './TokenApprove';
import RevokeTokenApprove from './RevokeTokenApprove';
import WrapToken from './WrapToken';
import UnWrapToken from './UnWrapToken';
import PushMultiSig from './PushMultiSig';
import CrossToken from './CrossToken';
import CrossSwapToken from './CrossSwapToken';
import RevokePermit2 from './RevokePermit2';
import {
  ActionRequireData,
  ApproveNFTRequireData,
  ApproveTokenRequireData,
  CancelTxRequireData,
  ContractCallRequireData,
  ParsedActionData,
  PushMultiSigRequireData,
  RevokeNFTRequireData,
  RevokeTokenApproveRequireData,
  SendRequireData,
  SwapRequireData,
  WrapTokenRequireData,
  getActionTypeText,
} from './utils';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconSpeedUp from '@/assets/icons/sign/tx/speedup.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24.svg';
import IconRabbyDecoded from '@/assets/icons/sign/rabby-decoded.svg';
import ViewRawModal from '../TxComponents/ViewRawModal';
import { CommonAction } from '../CommonAction';
import { Tip } from '@/components/Tip';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import RcIconCheck from '@/assets/icons/approval/icon-check.svg';

export const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    signTitle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
    },
    signTitleText: {
      color: colors['neutral-title-1'],
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
    },
    leftContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    leftText: {
      fontSize: 18,
      lineHeight: 21,
      color: colors['neutral-title-1'],
    },
    speedUpIcon: {
      width: 10,
      marginRight: 6,
    },
    rightText: {
      fontSize: 14,
      lineHeight: 16,
      color: '#999999',
    },
    actionWrapper: {
      backgroundColor: colors['neutral-bg-1'],
      borderRadius: 8,
    },
    actionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors['blue-default'],
      padding: 13,
      alignItems: 'center',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    left: {
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
      color: '#fff',
    },
    right: {
      fontSize: 14,
      lineHeight: 16,
      position: 'relative',
    },
    decodeTooltip: {
      maxWidth: 358,
    },
    isUnknown: {
      backgroundColor: colors['neutral-foot'],
    },
    container: {
      padding: 14,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
      backgroundColor: colors['neutral-card1'],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    containerLeft: {
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
      color: '#222222',
    },
    containerRight: {
      fontSize: 14,
      lineHeight: 16,
      color: '#999999',
    },
    viewRawText: {
      fontSize: 12,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    signTitleRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tipContent: {
      maxWidth: 358,
      padding: 12,
      alignItems: 'center',
      flexDirection: 'row',
    },
    tipContentIcon: {
      width: 12,
      height: 12,
      marginRight: 4,
    },
    actionHeaderRight: {
      fontSize: 14,
      lineHeight: 16,
      position: 'relative',
    },
    icon: {
      width: 24,
      height: 24,
    },
    signTitleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
  });

const Actions = ({
  data,
  requireData,
  chain,
  engineResults,
  txDetail,
  raw,
  onChange,
  isSpeedUp,
}: {
  data: ParsedActionData;
  requireData: ActionRequireData;
  chain: Chain;
  engineResults: Result[];
  txDetail: ExplainTxResponse;
  raw: Record<string, string | number>;
  onChange(tx: Record<string, any>): void;
  isSpeedUp: boolean;
}) => {
  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const handleViewRawClick = () => {
    ViewRawModal.open({
      raw,
      abi: txDetail?.abi_str,
    });
  };

  const isUnknown = data?.contractCall;

  return (
    <>
      <View style={styles.signTitle}>
        <View style={styles.signTitleLeft}>
          {isSpeedUp && <IconSpeedUp style={styles.speedUpIcon} />}
          <Text style={styles.signTitleText}>
            {t('page.signTx.signTransactionOnChain', { chain: chain.name })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.signTitleRight}
          onPress={handleViewRawClick}>
          <Text style={styles.viewRawText}>{t('page.signTx.viewRaw')}</Text>
          <RcIconArrowRight />
        </TouchableOpacity>
      </View>
      <View style={styles.actionWrapper}>
        <View
          style={{
            ...styles.actionHeader,
            ...(isUnknown ? styles.isUnknown : {}),
          }}>
          <View>
            <Text style={styles.left}>{actionName}</Text>
          </View>
          <View style={styles.actionHeaderRight}>
            <Tip
              placement="bottom"
              isLight
              content={
                isUnknown ? (
                  <NoActionAlert
                    data={{
                      chainId: chain.serverId,
                      contractAddress:
                        requireData && 'id' in requireData
                          ? requireData.id
                          : txDetail.type_call?.contract,
                      selector: raw.data.toString(),
                    }}
                  />
                ) : (
                  <View style={styles.tipContent}>
                    <RcIconCheck style={styles.tipContentIcon} />
                    <Text>{t('page.signTx.decodedTooltip')}</Text>
                  </View>
                )
              }>
              {isUnknown ? (
                <IconQuestionMark style={styles.icon} />
              ) : (
                <IconRabbyDecoded style={styles.icon} />
              )}
            </Tip>
          </View>
        </View>
        <View style={styles.container}>
          {data.swap && (
            <Swap
              data={data.swap}
              requireData={requireData as SwapRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}

          {data.crossToken && (
            <CrossToken
              data={data.crossToken}
              requireData={requireData as SwapRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data.crossSwapToken && (
            <CrossSwapToken
              data={data.crossSwapToken}
              requireData={requireData as SwapRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}

          {data.wrapToken && (
            <WrapToken
              data={data.wrapToken}
              requireData={requireData as WrapTokenRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data.unWrapToken && (
            <UnWrapToken
              data={data.unWrapToken}
              requireData={requireData as WrapTokenRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data.send && (
            <Send
              data={data.send}
              requireData={requireData as SendRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data.approveToken && (
            <TokenApprove
              data={data.approveToken}
              requireData={requireData as ApproveTokenRequireData}
              chain={chain}
              engineResults={engineResults}
              onChange={onChange}
              raw={raw}
            />
          )}
          {data.revokeToken && (
            <RevokeTokenApprove
              data={data.revokeToken}
              requireData={requireData as RevokeTokenApproveRequireData}
              chain={chain}
              engineResults={engineResults}
              onChange={onChange}
              raw={raw}
            />
          )}
          {data.revokePermit2 && (
            <RevokePermit2
              data={data.revokePermit2}
              requireData={requireData as RevokeTokenApproveRequireData}
              chain={chain}
              engineResults={engineResults}
              onChange={onChange}
              raw={raw}
            />
          )}
          {data?.sendNFT && (
            <SendNFT
              data={data.sendNFT}
              requireData={requireData as SendRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}

          {data?.revokeNFT && (
            <RevokeNFT
              data={data.revokeNFT}
              requireData={requireData as RevokeNFTRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data?.revokeNFTCollection && (
            <RevokeNFTCollection
              data={data.revokeNFTCollection}
              requireData={requireData as RevokeNFTRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data?.deployContract && <DeployContract />}
          {data?.pushMultiSig && (
            <PushMultiSig
              data={data.pushMultiSig}
              requireData={requireData as PushMultiSigRequireData}
              chain={chain}
            />
          )}
          {data.cancelTx && (
            <CancelTx
              data={data.cancelTx}
              requireData={requireData as CancelTxRequireData}
              chain={chain}
              engineResults={engineResults}
              onChange={onChange}
              raw={raw}
            />
          )}
          {data?.approveNFT && (
            <ApproveNFT
              data={data.approveNFT}
              requireData={requireData as ApproveNFTRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data?.approveNFTCollection && (
            <ApproveNFTCollection
              data={data.approveNFTCollection}
              requireData={requireData as RevokeNFTRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data.contractCall && (
            <ContractCall
              data={data.contractCall}
              requireData={requireData as ContractCallRequireData}
              chain={chain}
              engineResults={engineResults}
              onChange={onChange}
              raw={raw}
            />
          )}
          {data.common && (
            <CommonAction
              data={data.common}
              requireData={requireData as SwapRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
        </View>
      </View>
      <BalanceChange
        version={txDetail.pre_exec_version}
        data={txDetail.balance_change}
      />
    </>
  );
};

export default Actions;
