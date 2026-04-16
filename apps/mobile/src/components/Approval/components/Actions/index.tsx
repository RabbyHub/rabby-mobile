import { StyleSheet, View, TouchableOpacity } from 'react-native';
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
import type { MultiActionProps } from './types';
import { getActionsStyle } from './style';
import { Text } from '@/components/Typography';

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
