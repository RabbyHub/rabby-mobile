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
import IconQuestionMark from '@/assets/icons/sign/question-mark-24.svg';
import IconRabbyDecoded from '@/assets/icons/sign/rabby-decoded.svg';
import RcIconCheck from '@/assets/icons/approval/icon-check.svg';
import { AppColorsVariants } from '@/constant/theme';
import { Chain } from '@debank/common';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tip } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import CoboSafeCreate from './CoboSafeCreate';
import CoboSafeModificationDelegatedAddress from './CoboSafeModificationDelegatedAddress';
import CoboSafeModificationRule from './CoboSafeModificationRule';
import CoboSafeModificationTokenApproval from './CoboSafeModificationTokenApproval';
import { CommonAction } from '../CommonAction';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    signTitle: {
      justifyContent: 'space-between',
      marginBottom: 15,
      flexDirection: 'row',
      marginTop: 15,
    },
    signTitleLeft: {
      fontSize: 18,
      lineHeight: 21,
      color: colors['neutral-title-1'],
    },
    signTitleRight: {
      flexDirection: 'row',
    },
    iconSpeedup: {
      width: 10,
      marginRight: 6,
    },
    viewRawText: {
      fontSize: 12,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    viewRawIcon: {
      width: 16,
      height: 16,
      color: colors['neutral-foot'],
    },
    actionWrapper: {
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: colors['neutral-card-1'],
    },
    actionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      flexDirection: 'row',
      backgroundColor: colors['blue-default'],
      padding: 13,
      alignItems: 'center',
      borderRadius: 8,
    },
    isUnknown: {
      backgroundColor: colors['neutral-foot'],
    },
    actionHeaderLeft: {
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
      color: colors['neutral-title-2'],
    },
    actionHeaderRight: {
      fontSize: 14,
      lineHeight: 16,
      position: 'relative',
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
    icon: {
      width: 24,
      height: 24,
    },
    container: {
      padding: 14,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
    },
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
  });

const Actions = ({
  data,
  requireData,
  chain,
  engineResults,
  raw,
  message,
  origin,
}: {
  data: TypedDataActionData | null;
  requireData: TypedDataRequireData;
  chain?: Chain;
  engineResults: Result[];
  raw: Record<string, any>;
  message: string;
  origin: string;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

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
      <View style={styles.signTitle}>
        <Text style={styles.signTitleLeft}>
          {t('page.signTypedData.signTypeDataOnChain', {
            chain: chain ? chain.name : '',
          })}
        </Text>
        <TouchableOpacity
          style={styles.signTitleRight}
          onPress={handleViewRawClick}>
          <Text style={styles.viewRawText}>{t('page.signTx.viewRaw')}</Text>
          <RcIconArrowRight style={styles.viewRawIcon} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionWrapper}>
        <View
          style={StyleSheet.flatten([
            styles.actionHeader,
            isUnknown ? styles.isUnknown : {},
          ])}>
          <View className="left flex items-center">
            {data?.brand ? (
              <Image
                source={{ uri: data?.brand?.logo_url }}
                className="mr-8 w-20 h-20 rounded-full object-cover"
              />
            ) : null}
            <Text style={styles.actionHeaderLeft}>{actionName}</Text>
          </View>
          <View style={styles.actionHeaderRight}>
            <Tip
              placement="bottom"
              isLight
              content={
                isUnknown ? (
                  <NoActionAlert
                    data={{
                      origin,
                      text: message,
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
        {(data?.actionType || data?.actionType === null) && (
          <View style={styles.container}>
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
          </View>
        )}
      </View>
      <View>
        <View style={styles.messageTitleWrapper}>
          <Text style={styles.messageTitle}>{t('page.signText.message')}</Text>
          <View style={styles.messageTitleLine} />
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
