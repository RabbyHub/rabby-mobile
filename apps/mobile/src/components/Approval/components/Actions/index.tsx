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
  ContractRequireData,
  AssetOrderRequireData,
} from './utils';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconSpeedUp from '@/assets/icons/sign/tx/speedup.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24-cc.svg';
import ViewRawModal from '../TxComponents/ViewRawModal';
import { CommonAction } from '../CommonAction';
import { Tip } from '@/components/Tip';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import { Card } from './components/Card';
import { OriginInfo } from '../OriginInfo';
import { Divide } from './components/Divide';
import { Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import useCommonStyle from '../../hooks/useCommonStyle';
import AssetOrder from './AssetOrder';
import { BatchRevokePermit2 } from './BatchRevokePermit2';

export const getActionsStyle = (colors: AppColorsVariants) =>
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
      fontSize: 16,
      lineHeight: 18,
      color: colors['neutral-title-1'],
      fontWeight: '500',
    },
    speedUpIcon: {
      width: 16,
      marginRight: 4,
    },
    rightText: {
      fontSize: 14,
      lineHeight: 16,
      color: '#999999',
    },
    actionWrapper: {
      gap: 12,
    },
    actionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    decodeTooltip: {
      maxWidth: 358,
    },
    isUnknown: {},
    isUnknownText: {
      color: colors['neutral-foot'],
    },
    container: {
      paddingHorizontal: 16,
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
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    signTitleRight: {
      flexDirection: 'row',
      alignItems: 'center',
      float: 'right',
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
      width: 14,
      height: 14,
      marginRight: 2,
      marginTop: 2,
      color: colors['neutral-foot'],
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
  origin,
  originLogo,
}: {
  data: ParsedActionData;
  requireData: ActionRequireData;
  chain: Chain;
  engineResults: Result[];
  txDetail: ExplainTxResponse;
  raw: Record<string, string | number>;
  onChange(tx: Record<string, any>): void;
  isSpeedUp: boolean;
  origin?: string;
  originLogo?: string;
}) => {
  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getActionsStyle(colors);
  const commonStyle = useCommonStyle();

  const notShowBalanceChange = useMemo(() => {
    if (
      data.approveNFT ||
      data.approveNFTCollection ||
      data.approveToken ||
      data.cancelTx ||
      data.deployContract ||
      data.pushMultiSig ||
      data.revokeNFT ||
      data.revokeNFTCollection ||
      data.revokeToken
    ) {
      const balanceChange = txDetail.balance_change;
      if (!txDetail.pre_exec.success) return false;
      if (
        balanceChange.receive_nft_list.length +
          balanceChange.receive_token_list.length +
          balanceChange.send_nft_list.length +
          balanceChange.send_nft_list.length <=
        0
      ) {
        return true;
      }
    }
    return false;
  }, [data, txDetail]);

  const handleViewRawClick = () => {
    ViewRawModal.open({
      raw,
      abi: txDetail?.abi_str,
    });
  };

  const isUnknown = data?.contractCall;

  return (
    <View style={styles.actionWrapper}>
      <Card>
        <OriginInfo
          chain={chain}
          origin={origin}
          originLogo={originLogo}
          engineResults={engineResults}
        />
        {!notShowBalanceChange && (
          <>
            <Divide />
            <BalanceChange
              version={txDetail.pre_exec_version}
              data={txDetail.balance_change}
            />
          </>
        )}
      </Card>

      <Card>
        <View
          style={{
            ...styles.actionHeader,
            ...(isUnknown ? styles.isUnknown : {}),
          }}>
          <View
            style={StyleSheet.flatten({
              flexDirection: 'row',
              alignItems: 'center',
            })}>
            {isSpeedUp && (
              <Tip placement="bottom" content={t('page.signTx.speedUpTooltip')}>
                <IconSpeedUp style={styles.speedUpIcon} />
              </Tip>
            )}
            <Text
              style={StyleSheet.flatten({
                ...styles.leftText,
                ...(isUnknown ? styles.isUnknownText : {}),
              })}>
              {actionName}
            </Text>
            {isUnknown && (
              <Tip
                placement="bottom"
                isLight
                content={
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
                }>
                <IconQuestionMark
                  width={styles.icon.width}
                  height={styles.icon.height}
                  color={styles.icon.color}
                  style={styles.icon}
                />
              </Tip>
            )}
          </View>
          <TouchableOpacity
            style={styles.signTitleRight}
            onPress={handleViewRawClick}>
            <Text style={styles.viewRawText}>{t('page.signTx.viewRaw')}</Text>
            <RcIconArrowRight />
          </TouchableOpacity>
        </View>
        <Divide />
        <View style={styles.container}>
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.chain')}
              </Text>
            </Row>
            <Row>
              <LogoWithText
                textStyle={commonStyle.primaryText}
                logo={chain.logo}
                text={chain.name}
              />
            </Row>
          </Col>

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
          {data?.sendNFT && (
            <SendNFT
              data={data.sendNFT}
              requireData={requireData as SendRequireData}
              chain={chain}
              engineResults={engineResults}
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
          {data?.approveNFTCollection && (
            <ApproveNFTCollection
              data={data.approveNFTCollection}
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
          {data?.assetOrder && (
            <AssetOrder
              data={data.assetOrder}
              requireData={requireData as ContractRequireData}
              chain={chain}
              engineResults={engineResults}
              sender={(requireData as AssetOrderRequireData).sender}
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
              requireData={requireData as ContractCallRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {data.permit2BatchRevokeToken && (
            <BatchRevokePermit2
              data={data.permit2BatchRevokeToken}
              requireData={requireData as RevokeTokenApproveRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
        </View>
      </Card>
    </View>
  );
};

export default Actions;
