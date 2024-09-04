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
  ApproveNFTRequireData,
  RevokeTokenApproveRequireData,
  SendRequireData,
  ParsedTypedDataActionData,
  ActionRequireData,
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
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Tip } from '@/components';
import { useThemeColors } from '@/hooks/theme';
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
import ApproveNFT from '../Actions/ApproveNFT';
import Send from '../Actions/Send';
import AssetOrder from '../Actions/AssetOrder';
import { getActionTypeText } from './utils';

const Actions = ({
  data,
  requireData,
  chain,
  engineResults,
  raw,
  message,
  origin,
  originLogo,
}: {
  data: ParsedTypedDataActionData | null;
  requireData: ActionRequireData;
  chain?: Chain;
  engineResults: Result[];
  raw: Record<string, any>;
  message: string;
  origin: string;
  originLogo?: string;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getMessageStyles(colors), [colors]);
  const actionStyles = getActionsStyle(colors);
  const commonStyle = useCommonStyle();

  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);

  const handleViewRawClick = () => {
    ViewRawModal.open({
      raw,
    });
  };

  const isUnknown = (!data?.actionType && !data?.common) || data?.contractCall;

  return (
    <View>
      <View style={actionStyles.actionWrapper}>
        <Card>
          <OriginInfo
            origin={origin}
            originLogo={originLogo}
            engineResults={engineResults}
          />
        </Card>

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
                {data.approveNFT && chain && (
                  <ApproveNFT
                    data={data.approveNFT}
                    requireData={requireData as ApproveNFTRequireData}
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
                {data.assetOrder && chain && (
                  <AssetOrder
                    data={data.assetOrder}
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
                {data.send && chain && (
                  <Send
                    data={data.send}
                    requireData={requireData as SendRequireData}
                    chain={chain}
                    engineResults={engineResults}
                  />
                )}
                {data.createKey && (
                  <CreateKey
                    data={data.createKey}
                    engineResults={engineResults}
                  />
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
                  <CoboSafeModificationRule
                    data={data.coboSafeModificationRole}
                  />
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
              </View>
            )
          )}
        </Card>
      </View>
      <Card style={styles.messageCard}>
        <ScrollView
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
        </ScrollView>
      </Card>
    </View>
  );
};

export default Actions;
