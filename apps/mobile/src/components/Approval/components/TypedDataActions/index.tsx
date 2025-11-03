import { Result } from '@rabby-wallet/rabby-security-engine';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ViewRawModal from '../TxComponents/ViewRawModal';
import {
  ApproveTokenRequireData,
  ContractRequireData,
  MultiSigRequireData,
  SwapTokenOrderRequireData,
  BatchApproveTokenRequireData,
  RevokeTokenApproveRequireData,
  ParsedTypedDataActionData,
  ActionRequireData,
  ParsedTransactionActionData,
} from '@rabby-wallet/rabby-action';
import BuyNFT from './BuyNFT';
import SellNFT from './SellNFT';
import Permit from './Permit';
import Permit2 from './Permit2';
import ContractCall from './ContractCall';
import SwapTokenOrder from './SwapTokenOrder';
import SignMultisig from './SignMultisig';
import CreateKey from '../TextActions/CreateKey';
import VerifyAddress from '../TextActions/VerifyAddress';
import BatchSellNFT from './BatchSellNFT';
import BatchPermit2 from './BatchPermit2';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24-cc.svg';
import { Chain } from '@/constant/chains';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tip } from '@/components';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import CoboSafeCreate from './CoboSafeCreate';
import CoboSafeModificationDelegatedAddress from './CoboSafeModificationDelegatedAddress';
import CoboSafeModificationRule from './CoboSafeModificationRule';
import CoboSafeModificationTokenApproval from './CoboSafeModificationTokenApproval';
import { CommonAction } from '../CommonAction';
import { getActionsStyle } from '../Actions';
import { Card } from '../Actions/components/Card';
import { OriginInfo } from '../OriginInfo';
import { Divide } from '../Actions/components/Divide';
import { getMessageStyles } from '../TextActions';
import LogoWithText from '../Actions/components/LogoWithText';
import { Col, Row } from '../Actions/components/Table';
import useCommonStyle from '../../hooks/useCommonStyle';
import RevokePermit2 from '../Actions/RevokePermit2';
import { getActionTypeText } from './utils';
import { TransactionActionList } from '../Actions/components/TransactionActionList';
import { noop } from 'lodash';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Account } from '@/core/services/preference';
import { ParseCommonResponse } from '@rabby-wallet/rabby-api/dist/types';
import { CHAINS } from '@debank/common';
import { CHAINS_ENUM } from '@/constant/chains';
import { BalanceChangeWrapper } from '../TxComponents/BalanceChangeWrapper';

export interface MultiActionProps {
  actionList: ParsedTypedDataActionData[] | ParsedTransactionActionData[];
  requireDataList: ActionRequireData[];
  engineResultList: Result[][];
}
const ActionItem = ({
  raw,
  chain,
  data,
  requireData,
  engineResults,
  account,
  message,
  origin,
}: {
  data: ParsedTypedDataActionData | null;
  requireData: ActionRequireData;
  chain?: Chain;
  engineResults: Result[];
  raw: Record<string, any>;
  message: string;
  typedDataActionData?: ParseCommonResponse | null;
  account: Account;
  origin: string;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getMessageStyles(colors), [colors]);
  const { styles: actionStyles } = useTheme2024({ getStyle: getActionsStyle });

  const commonStyle = useCommonStyle();

  const isUnknown = (!data?.actionType && !data?.common) || data?.contractCall;

  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);

  const handleViewRawClick = () => {
    ViewRawModal.open({
      raw,
    });
  };

  return (
    <Card>
      <View
        style={{
          ...actionStyles.actionHeader,
          ...(isUnknown ? actionStyles.isUnknown : {}),
        }}>
        <View
          style={StyleSheet.flatten({
            flexDirection: 'row',
            alignItems: 'center',
          })}>
          <Text
            style={StyleSheet.flatten({
              ...actionStyles.leftText,
              ...(isUnknown ? actionStyles.isUnknownText : {}),
            })}>
            {actionName}
          </Text>
          {isUnknown && (
            <Tip
              placement="bottom"
              isLight
              content={
                <NoActionAlert
                  account={account}
                  data={{
                    origin,
                    text: message,
                  }}
                />
              }>
              <IconQuestionMark
                width={actionStyles.icon.width}
                height={actionStyles.icon.height}
                color={actionStyles.icon.color}
                style={actionStyles.icon}
              />
            </Tip>
          )}
        </View>
        <TouchableOpacity
          style={actionStyles.signTitleRight}
          onPress={handleViewRawClick}>
          <Text style={actionStyles.viewRawText}>
            {t('page.signTx.viewRaw')}
          </Text>
          <RcIconArrowRight />
        </TouchableOpacity>
      </View>
      {data && <Divide />}

      {chain?.isTestnet ? (
        <Text style={styles.testnetMessage}>
          {JSON.stringify(raw, null, 2)}
        </Text>
      ) : (
        (data?.actionType || data?.actionType === null) && (
          <View style={actionStyles.container}>
            {chain && (
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
            )}

            {data.permit && (
              <Permit
                data={data.permit}
                requireData={requireData as ApproveTokenRequireData}
                chain={chain}
                engineResults={engineResults}
              />
            )}
            {data.revokePermit && chain && (
              <RevokePermit2
                data={data.revokePermit}
                requireData={requireData as RevokeTokenApproveRequireData}
                chain={chain}
                engineResults={engineResults}
              />
            )}
            {data.permit2 && chain && (
              <Permit2
                data={data.permit2}
                requireData={requireData as ApproveTokenRequireData}
                chain={chain}
                engineResults={engineResults}
              />
            )}
            {data.batchPermit2 && chain && (
              <BatchPermit2
                data={data.batchPermit2}
                requireData={requireData as BatchApproveTokenRequireData}
                chain={chain}
                engineResults={engineResults}
              />
            )}
            {data.swapTokenOrder && chain && (
              <SwapTokenOrder
                data={data.swapTokenOrder}
                requireData={requireData as SwapTokenOrderRequireData}
                chain={chain}
                engineResults={engineResults}
              />
            )}
            {data.buyNFT && chain && (
              <BuyNFT
                data={data.buyNFT}
                requireData={requireData as ContractRequireData}
                chain={chain}
                engineResults={engineResults}
                sender={data.sender}
              />
            )}
            {data.batchSellNFT && chain && (
              <BatchSellNFT
                data={data.batchSellNFT}
                requireData={requireData as ContractRequireData}
                chain={chain}
                engineResults={engineResults}
                sender={data.sender}
              />
            )}
            {data.sellNFT && chain && (
              <SellNFT
                data={data.sellNFT}
                requireData={requireData as ContractRequireData}
                chain={chain}
                engineResults={engineResults}
                sender={data.sender}
              />
            )}
            {data.signMultiSig && (
              <SignMultisig
                data={data.signMultiSig}
                requireData={requireData as MultiSigRequireData}
                chain={chain}
                engineResults={engineResults}
              />
            )}
            {data.createKey && (
              <CreateKey data={data.createKey} engineResults={engineResults} />
            )}
            {data.verifyAddress && (
              <VerifyAddress
                data={data.verifyAddress}
                engineResults={engineResults}
              />
            )}
            {data.contractCall && chain && (
              <ContractCall
                data={data.permit}
                requireData={requireData as ContractRequireData}
                chain={chain}
                engineResults={engineResults}
                raw={raw}
              />
            )}
            {data.coboSafeCreate && (
              <CoboSafeCreate data={data.coboSafeCreate} />
            )}
            {data.coboSafeModificationRole && (
              <CoboSafeModificationRule data={data.coboSafeModificationRole} />
            )}
            {data.coboSafeModificationDelegatedAddress && (
              <CoboSafeModificationDelegatedAddress
                data={data.coboSafeModificationDelegatedAddress}
              />
            )}
            {data.coboSafeModificationTokenApproval && (
              <CoboSafeModificationTokenApproval
                data={data.coboSafeModificationTokenApproval}
              />
            )}
            {data.common && (
              <CommonAction
                data={data.common}
                requireData={requireData as ContractRequireData}
                chain={chain}
                engineResults={engineResults}
              />
            )}
            {chain && (
              <TransactionActionList
                data={data}
                requireData={requireData}
                chain={chain}
                engineResults={engineResults}
                raw={raw}
                isTypedData
                onChange={noop}
              />
            )}
          </View>
        )
      )}
    </Card>
  );
};

const Actions = ({
  data,
  requireData,
  chain = CHAINS[CHAINS_ENUM.ETH],
  engineResults,
  raw,
  message,
  origin,
  originLogo,
  typedDataActionData,
  account,
  multiAction,
}: {
  data: ParsedTypedDataActionData | null;
  requireData: ActionRequireData;
  chain?: Chain;
  engineResults: Result[];
  raw: Record<string, any>;
  message: string;
  origin: string;
  originLogo?: string;
  typedDataActionData?: ParseCommonResponse | null;
  account: Account;
  multiAction?: MultiActionProps;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getMessageStyles(colors), [colors]);
  const { styles: actionStyles } = useTheme2024({ getStyle: getActionsStyle });

  const isMultiAction = useMemo(() => {
    return !!multiAction;
  }, [multiAction]);

  return (
    <View>
      <View style={actionStyles.actionWrapper}>
        <Card>
          <OriginInfo
            origin={origin}
            originLogo={originLogo}
            engineResults={engineResults}
          />
          <BalanceChangeWrapper
            data={data}
            balanceChange={typedDataActionData?.pre_exec_result?.balance_change}
            preExecSuccess={typedDataActionData?.pre_exec?.success}
            preExecVersion={
              typedDataActionData?.pre_exec_result?.pre_exec_version
            }
          />
        </Card>
        {isMultiAction && multiAction ? (
          (multiAction.actionList as ParsedTypedDataActionData[]).map(
            (action, index) => (
              <ActionItem
                key={index}
                data={action}
                requireData={multiAction.requireDataList[index]}
                chain={chain}
                engineResults={multiAction.engineResultList[index]}
                raw={raw}
                message={message}
                account={account}
                origin={origin}
              />
            ),
          )
        ) : (
          <ActionItem
            data={data}
            requireData={requireData}
            chain={chain}
            engineResults={engineResults}
            raw={raw}
            message={message}
            account={account}
            origin={origin}
          />
        )}
      </View>

      <Card style={styles.messageCard}>
        <BottomSheetScrollView
          nestedScrollEnabled
          style={StyleSheet.flatten([
            styles.messageContent,
            data ? {} : styles.noAction,
          ])}>
          <View style={styles.messageTitle}>
            <Text
              style={styles.dashLine}
              ellipsizeMode="clip"
              accessible={false}
              numberOfLines={1}>
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            </Text>

            <Text style={styles.messageTitleText}>
              {t('page.signTx.typedDataMessage')}
            </Text>
          </View>
          <Text style={styles.messageText}>{message}</Text>
        </BottomSheetScrollView>
      </Card>
    </View>
  );
};

export default Actions;
