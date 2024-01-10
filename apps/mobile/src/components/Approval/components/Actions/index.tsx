import { StyleSheet, View } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Chain } from '@debank/common';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BalanceChange from '../TxComponents/BalanceChange';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
// import ViewRawModal from '../TxComponents/ViewRawModal';
// import ApproveNFT from './ApproveNFT';
// import ApproveNFTCollection from './ApproveNFTCollection';
// import CancelTx from './CancelTx';
// import ContractCall from './ContractCall';
// import DeployContract from './DeployContract';
// import RevokeNFT from './RevokeNFT';
// import RevokeNFTCollection from './RevokeNFTCollection';
import Send from './Send';
// import SendNFT from './SendNFT';
// import Swap from './Swap';
// import TokenApprove from './TokenApprove';
// import RevokeTokenApprove from './RevokeTokenApprove';
// import WrapToken from './WrapToken';
// import UnWrapToken from './UnWrapToken';
// import PushMultiSig from './PushMultiSig';
// import CrossToken from './CrossToken';
// import CrossSwapToken from './CrossSwapToken';
// import RevokePermit2 from './RevokePermit2';
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
import IconSpeedUp from 'ui/assets/sign/tx/speedup.svg';
import IconQuestionMark from 'ui/assets/sign/question-mark-24.svg';
import IconRabbyDecoded from 'ui/assets/sign/rabby-decoded.svg';
import clsx from 'clsx';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    signTitle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
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
      color: '#fff',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    left: {
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
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
    // ViewRawModal.open({
    //   raw,
    //   abi: txDetail?.abi_str,
    // });
  };

  return (
    <>
      <View style={styles.signTitle}>
        <div className="left relative">
          {isSpeedUp && <IconSpeedUp style={styles.speedUpIcon} />}
          {t('page.signTx.signTransactionOnChain', { chain: chain.name })}
        </div>
        <div
          className="float-right text-12 cursor-pointer flex items-center view-raw"
          onClick={handleViewRawClick}>
          {t('page.signTx.viewRaw')}
          <RcIconArrowRight />
        </div>
      </View>
      <View style={styles.actionWrapper}>
        <div
          className={clsx('action-header', {
            'is-unknown': data.contractCall,
          })}>
          <div className="left">{actionName}</div>
          <div className="right">
            {data.contractCall ? (
              <IconQuestionMark className="w-24" />
            ) : (
              <IconRabbyDecoded className="w-24" />
            )}
          </div>
        </div>
        <div className="container">
          {/* {data.swap && (
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
          )} */}
          {data.send && (
            <Send
              data={data.send}
              requireData={requireData as SendRequireData}
              chain={chain}
              engineResults={engineResults}
            />
          )}
          {/* {data.approveToken && (
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
              raw={raw}></CancelTx>
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
          {data.contractCall && (
            <ContractCall
              data={data.contractCall}
              requireData={requireData as ContractCallRequireData}
              chain={chain}
              engineResults={engineResults}
              onChange={onChange}
              raw={raw}
            />
          )} */}
        </div>
      </View>
      <BalanceChange
        version={txDetail.pre_exec_version}
        data={txDetail.balance_change}
      />
    </>
  );
};

export default Actions;
