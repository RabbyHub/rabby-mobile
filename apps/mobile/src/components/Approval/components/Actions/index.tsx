import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Chain } from '@/constant/chains';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BalanceChangeWrapper } from '../TxComponents/BalanceChangeWrapper';
import { useTheme2024 } from '@/hooks/theme';
import {
  ActionRequireData,
  ParsedActionData,
  ParsedTransactionActionData,
} from '@rabby-wallet/rabby-action';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconSpeedUp from '@/assets/icons/sign/tx/speedup.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24-cc.svg';
import ViewRawModal from '../TxComponents/ViewRawModal';
import { Tip } from '@/components/Tip';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import { Card } from './components/Card';
import { OriginInfo } from '../OriginInfo';
import { Divide } from './components/Divide';
import { Col, Row } from './components/Table';
import useCommonStyle from '../../hooks/useCommonStyle';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { getActionTypeText } from './utils';
import { TransactionActionList } from './components/TransactionActionList';
import { Account } from '@/core/services/preference';
import { MultiActionProps } from '../TypedDataActions';
import { createGetStyles2024 } from '@/utils/styles';

export const getActionsStyle = createGetStyles2024(
  ({ colors, colors2024 }) => ({
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
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 18,
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
      // color: colors['neutral-foot'],
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
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 20,
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
      width: 20,
      height: 20,
      marginRight: 2,
      marginTop: 2,
      color: colors2024['neutral-info'],
    },
    signTitleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    chainInfo: {
      flexDirection: 'row',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    rpcBadge: {
      top: -2,
      right: -2,
      width: 8,
      height: 8,
    },
  }),
);

const ActionItem = ({
  isSpeedUp,
  account,
  chain,
  requireData,
  txDetail,
  raw,
  data,
  engineResults,
  onChange,
}: {
  data: ParsedTransactionActionData;
  requireData: ActionRequireData;
  chain: Chain;
  engineResults: Result[];
  txDetail: ExplainTxResponse;
  raw: Record<string, string | number>;
  onChange(tx: Record<string, any>): void;
  isSpeedUp: boolean;
  account: Account;
}) => {
  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getActionsStyle });
  const commonStyle = useCommonStyle();

  const handleViewRawClick = () => {
    ViewRawModal.open({
      raw,
      abi: txDetail?.abi_str,
    });
  };

  const isUnknown = data?.contractCall;
  return (
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
            <View style={styles.chainInfo}>
              <ChainIconImage
                chainEnum={chain.enum}
                size={16}
                isShowRPCStatus
                badgeStyle={styles.rpcBadge}
              />
              <Text style={commonStyle.primaryText}>{chain.name}</Text>
            </View>
          </Row>
        </Col>
        <TransactionActionList
          data={data}
          requireData={requireData}
          chain={chain}
          engineResults={engineResults}
          raw={raw}
          onChange={onChange}
        />
      </View>
    </Card>
  );
};

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
  account,
  multiAction,
  inDappAction,
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
  account: Account;
  multiAction?: MultiActionProps;
  inDappAction?: boolean;
}) => {
  const isMultiAction = useMemo(() => {
    return !!multiAction;
  }, [multiAction]);
  const { styles } = useTheme2024({ getStyle: getActionsStyle });

  return (
    <View style={styles.actionWrapper}>
      <Card>
        <OriginInfo
          chain={chain}
          origin={origin}
          originLogo={originLogo}
          engineResults={engineResults}
          inDappAction={inDappAction}
        />
        <BalanceChangeWrapper
          data={data}
          balanceChange={txDetail.balance_change}
          preExecSuccess={txDetail.pre_exec.success}
          preExecVersion={txDetail.pre_exec_version}
        />
      </Card>
      {isMultiAction && multiAction ? (
        (multiAction.actionList as ParsedActionData[]).map((action, index) => (
          <ActionItem
            key={index}
            data={action}
            requireData={multiAction.requireDataList[index]}
            chain={chain}
            engineResults={multiAction.engineResultList[index]}
            raw={raw}
            account={account}
            txDetail={txDetail}
            onChange={onChange}
            isSpeedUp={isSpeedUp}
          />
        ))
      ) : (
        <ActionItem
          data={data}
          requireData={requireData}
          chain={chain}
          engineResults={engineResults}
          raw={raw}
          account={account}
          txDetail={txDetail}
          onChange={onChange}
          isSpeedUp={isSpeedUp}
        />
      )}
    </View>
  );
};

export default Actions;
