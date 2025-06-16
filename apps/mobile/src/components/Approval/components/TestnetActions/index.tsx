import { Chain } from '@/constant/chains';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// import {
//   ActionRequireData,
//   ApproveNFTRequireData,
//   ApproveTokenRequireData,
//   CancelTxRequireData,
//   ContractCallRequireData,
//   ParsedActionData,
//   PushMultiSigRequireData,
//   RevokeNFTRequireData,
//   RevokeTokenApproveRequireData,
//   SendRequireData,
//   SwapRequireData,
//   WrapTokenRequireData,
//   getActionTypeText,
//   ContractRequireData,
//   AssetOrderRequireData,
// } from './utils';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24-cc.svg';
import IconSpeedUp from '@/assets/icons/sign/tx/speedup.svg';
// import ViewRawModal from '../TxComponents/ViewRawModal';
// import { CommonAction } from '../CommonAction';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';
import { Tip } from '@/components/Tip';
import { Card } from '../Actions/components/Card';
import { Divide } from '../Actions/components/Divide';
import LogoWithText from '../Actions/components/LogoWithText';
import { Col, Row } from '../Actions/components/Table';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import { OriginInfo } from '../OriginInfo';
import Loading from '../TxComponents/Loading';
import ViewRawModal from '../TxComponents/ViewRawModal';
import BalanceChange from '../TxComponents/BalanceChange';
import { getMessageStyles } from '../TextActions';
import { Account } from '@/core/services/preference';

export const TestnetActions = ({
  chain,
  raw,
  isSpeedUp,
  origin,
  originLogo,
  isReady,
  account,
}: {
  chain: Chain;
  raw: Record<string, string | number>;
  isSpeedUp: boolean;
  origin?: string;
  originLogo?: string;
  isReady?: boolean;
  account: Account;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => {
    return {
      ...getActionsStyle(colors),
      ...getMessageStyles(colors),
    };
  }, [colors]);

  const commonStyle = useCommonStyle();
  const isUnknown = true;
  const actionName = t('page.signTx.unknownActionType');

  const handleViewRawClick = () => {
    ViewRawModal.open({
      raw,
    });
  };

  const message = useMemo(() => {
    try {
      return JSON.stringify(raw, null, 2);
    } catch (error) {
      return '';
    }
  }, [raw]);

  if (!isReady) {
    return <Loading />;
  }

  return (
    <View style={styles.actionWrapper}>
      <Card>
        <OriginInfo chain={chain} origin={origin} originLogo={originLogo} />
        <Divide />
        <BalanceChange version="v0" account={account} />
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
                    account={account}
                    data={{
                      chainId: chain.serverId,
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
        </View>
      </Card>

      <Card style={styles.messageCard}>
        <ScrollView
          style={StyleSheet.flatten([styles.messageContent, styles.noAction])}>
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
              {t('page.customTestnet.signTx.title')}
            </Text>
          </View>
          <Text style={styles.messageText}>{message}</Text>
        </ScrollView>
      </Card>
    </View>
  );
};

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
      // @ts-expect-error maybe invalid style
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
