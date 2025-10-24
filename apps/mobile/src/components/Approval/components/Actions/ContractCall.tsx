import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ContractCallRequireData,
  ParsedActionData,
} from '@rabby-wallet/rabby-action';
import { formatTokenAmount } from '@/utils/number';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { ProtocolListItem } from './components/ProtocolListItem';
import { SecurityListItem } from './components/SecurityListItem';
import IconQuestionMark from '@/assets2024/icons/common/help-cc.svg';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from './components/SubTable';
import { Tip } from '@/components';
import { useTheme2024 } from '@/hooks/theme';

const { isSameAddress } = addressUtils;

const ContractCall = ({
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['contractCall'];
  requireData: ContractCallRequireData;
  chain: Chain;
  raw: Record<string, string | number>;
  engineResults: Result[];
  onChange(tx: Record<string, any>): void;
}) => {
  const { userData, init } = useApprovalSecurityEngine();
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const { contractWhitelist } = userData;
  const { colors2024 } = useTheme2024();

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain.serverId &&
        isSameAddress(item.address, requireData.id),
    );
  }, [contractWhitelist, requireData, chain]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contractCallAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.interactContract')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="contract"
              data={{
                bornAt: requireData.bornAt,
                protocol: requireData.protocol,
                rank: requireData.rank,
                address: requireData.id,
                hasInteraction: requireData.hasInteraction,
                chain,
              }}>
              <View ref={contractCallAddressRef}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={contractCallAddressRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.protocol')}
              </Text>
            </SubRow>
            <SubRow>
              <ProtocolListItem
                style={commonStyle.subRowText}
                protocol={requireData.protocol}
              />
            </SubRow>
          </SubCol>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.interacted')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.Boolean value={requireData.hasInteraction} />
            </SubRow>
          </SubCol>
          {isInWhitelist && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.myMark')}
                </Text>
              </SubRow>
              <SubRow>
                <Text style={commonStyle.subRowText}>
                  {t('page.signTx.trusted')}
                </Text>
              </SubRow>
            </SubCol>
          )}
          <SecurityListItem
            id="1152"
            engineResult={engineResultMap['1152']}
            title={t('page.signTx.tokenApprove.flagByRabby')}
            dangerText={t('page.signTx.yes')}
          />
          <SecurityListItem
            id="1135"
            engineResult={engineResultMap['1135']}
            forbiddenText={t('page.signTx.markAsBlock')}
            title={t('page.signTx.myMark')}
          />

          <SecurityListItem
            id="1137"
            engineResult={engineResultMap['1137']}
            warningText={t('page.signTx.markAsBlock')}
            title={t('page.signTx.myMark')}
          />
        </SubTable>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.contractCall.operation')}
            </Text>
          </Row>
          <Row>
            <View
              style={StyleSheet.flatten({
                flexDirection: 'row',
                alignItems: 'center',
              })}>
              <Text style={commonStyle.primaryText}>
                {requireData.call.func || '-'}
              </Text>
              <Tip
                content={
                  requireData.call.func
                    ? t('page.signTx.contractCall.operationABIDesc')
                    : t('page.signTx.contractCall.operationCantDecode')
                }>
                <IconQuestionMark
                  style={StyleSheet.flatten({
                    width: 16,
                    height: 16,
                    marginLeft: 6,
                  })}
                  color={colors2024['neutral-info']}
                />
              </Tip>
            </View>
          </Row>
        </Col>
        {new BigNumber(requireData.payNativeTokenAmount).gt(0) && (
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.contractCall.payNativeToken', {
                  symbol: requireData.nativeTokenSymbol,
                })}
              </Text>
            </Row>
            {
              <Row>
                <Text style={commonStyle.primaryText}>
                  {formatTokenAmount(
                    new BigNumber(requireData.payNativeTokenAmount)
                      .div(1e18)
                      .toFixed(),
                  )}{' '}
                  {requireData.nativeTokenSymbol}
                </Text>
              </Row>
            }
          </Col>
        )}
      </Table>
    </View>
  );
};

export default ContractCall;
