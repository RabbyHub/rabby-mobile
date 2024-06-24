import { Result } from '@rabby-wallet/rabby-security-engine';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ViewRawModal from '../TxComponents/ViewRawModal';
import {
  ApproveTokenRequireData,
  ContractRequireData,
  MultiSigRequireData,
  SwapTokenOrderRequireData,
  TypedDataActionData,
  TypedDataRequireData,
  getActionTypeText,
  BatchApproveTokenRequireData,
} from './utils';
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
import { AppColorsVariants } from '@/constant/theme';
import { Chain } from '@/constant/chains';
import {
  Platform,
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

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    messageWrapper: {},
    messageTitleWrapper: {
      position: 'relative',
      height: 16,
      marginVertical: 10,
    },
    messageTitle: {
      position: 'relative',
      fontSize: 14,
      lineHeight: 16,
      color: colors['neutral-foot'],
      textAlign: 'center',
      backgroundColor: colors['neutral-bg-2'],
      alignSelf: 'center',
      paddingHorizontal: 12,
    },
    messageTitleLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      top: 6,
      borderStyle: 'dashed',
      borderTopWidth: 1,
      borderColor: colors['neutral-line'],
      zIndex: -1,
    },
    messageContent: {
      padding: 15,
      wordBreak: 'break-all',
      whiteSpace: 'pre-wrap',
      backgroundColor: colors['neutral-card-1'],
      borderColor: colors['neutral-line'],
      borderWidth: 1,
      borderRadius: 6,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '500',
      color: colors['neutral-body'],
      // height: 320,
    },
    noAction: {
      backgroundColor: colors['neutral-card-3'],
    },
    tabView: {
      backgroundColor: colors['neutral-card-2'],
      padding: 15,
      marginVertical: 15,
      flex: 1,
    },
    popupView: {
      padding: 15,
      flex: 1,
    },
    indicator: {
      backgroundColor: colors['blue-default'],
      color: colors['blue-default'],
    },
    indicatorText: {
      color: colors['blue-default'],
    },
    testnetMessage: {
      padding: 15,
      fontSize: 13,
      flexWrap: 'wrap',
      lineHeight: 16,
      color: colors['neutral-body'],
      height: 260,
      fontWeight: '500',
    },
  });

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
  data: TypedDataActionData | null;
  requireData: TypedDataRequireData;
  chain?: Chain;
  engineResults: Result[];
  raw: Record<string, any>;
  message: string;
  origin: string;
  originLogo?: string;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const actionStyles = getActionsStyle(colors);

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
                {data.permit && chain && (
                  <Permit
                    data={data.permit}
                    requireData={requireData as ApproveTokenRequireData}
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
      <View>
        <View style={styles.messageTitleWrapper}>
          <Text style={styles.messageTitle}>{t('page.signText.message')}</Text>
          <View
            style={StyleSheet.flatten([
              styles.messageTitleLine,
              Platform.select({
                ios: {
                  borderStyle: 'solid',
                },
              }),
            ])}
          />
        </View>
        <View
          style={StyleSheet.flatten([
            styles.messageContent,
            data ? {} : styles.noAction,
          ])}>
          <Text>{message}</Text>
        </View>
      </View>
    </View>
  );
};

export default Actions;
