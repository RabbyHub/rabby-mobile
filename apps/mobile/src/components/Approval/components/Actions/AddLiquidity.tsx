import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  AddLiquidityRequireData,
  ParsedActionData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import { SecurityListItem } from './components/SecurityListItem';
import ViewMore from './components/ViewMore';
import { ProtocolListItem } from './components/ProtocolListItem';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubCol, SubRow, SubTable } from './components/SubTable';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import LogoWithText from './components/LogoWithText';
import { formatAmount } from '@/utils/number';
import SecurityLevelTagNoText from '../SecurityEngine/SecurityLevelTagNoText';

const AddLiquidity = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['addLiquidity'];
  requireData: AddLiquidityRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const { token0, token1 } = data!;
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const { currentTx, userData, rules, openRuleDrawer, init } =
    useApprovalSecurityEngine();

  const isInWhitelist = useMemo(() => {
    return userData.contractWhitelist.some(
      item =>
        item.chainId === chain.serverId &&
        isSameAddress(item.address, requireData.id),
    );
  }, [userData, requireData, chain]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const hasReceiver = useMemo(() => {
    return !isSameAddress(requireData.receiver, requireData.sender);
  }, [requireData.receiver, requireData.sender]);

  const handleClickRule = (id: string) => {
    const rule = rules.find(item => item.id === id);
    if (!rule) {
      return;
    }
    const result = engineResultMap[id];
    openRuleDrawer({
      ruleConfig: rule,
      value: result?.value,
      level: result?.level,
      ignored: currentTx.processedRules.includes(id),
    });
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contractAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.addLiquidity.token0')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={token0.logo_url}
              text={
                <View style={commonStyle.row}>
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(token0.amount)}{' '}
                  </Text>
                  <Values.TokenSymbol token={token0} />
                </View>
              }
            />
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.addLiquidity.token1')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={token1.logo_url}
              text={
                <View style={commonStyle.row}>
                  <Text style={commonStyle.primaryText}>
                    {formatAmount(token1.amount)}{' '}
                  </Text>
                  <Values.TokenSymbol token={token1} />
                </View>
              }
            />
          </Row>
        </Col>

        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.addLiquidity.poolPrice')}
            </Text>
          </Row>
          <Row>
            <View style={commonStyle.row}>
              <Text style={commonStyle.primaryText}>1 </Text>
              <Values.TokenSymbol token={token0} />
              <Text style={commonStyle.primaryText}>
                {' '}
                = {formatAmount(requireData.poolRate)}{' '}
              </Text>
              <Values.TokenSymbol token={token1} />
            </View>
          </Row>
        </Col>

        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.addLiquidity.marketPrice')}
            </Text>
          </Row>
          <Row>
            <View style={commonStyle.row}>
              <Text style={commonStyle.primaryText}>1 </Text>
              <Values.TokenSymbol token={token0} />
              <Text style={commonStyle.primaryText}>
                {' '}
                = {formatAmount(requireData.marketRate)}{' '}
              </Text>
              <Values.TokenSymbol token={token1} />
            </View>
          </Row>
        </Col>

        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.addLiquidity.priceDiff')}
            </Text>
          </Row>
          <Row>
            <View>
              <Text style={commonStyle.primaryText}>
                {formatAmount(requireData.diff)}%
              </Text>
              {engineResultMap['1154'] && (
                <SecurityLevelTagNoText
                  inSubTable
                  enable={engineResultMap['1154'].enable}
                  level={
                    currentTx.processedRules.includes('1154')
                      ? 'proceed'
                      : engineResultMap['1154'].level
                  }
                  onClick={() => handleClickRule('1154')}
                />
              )}
            </View>
          </Row>
        </Col>

        {hasReceiver && (
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.addLiquidity.receiver')}
              </Text>
            </Row>
            <Row>
              <Values.AddressWithCopy
                address={requireData.receiver}
                chain={chain}
              />
              {engineResultMap['1153'] && (
                <SecurityLevelTagNoText
                  inSubTable
                  enable={engineResultMap['1153'].enable}
                  level={
                    currentTx.processedRules.includes('1153')
                      ? 'proceed'
                      : engineResultMap['1153'].level
                  }
                  onClick={() => handleClickRule('1153')}
                />
              )}
            </Row>
          </Col>
        )}

        <Col>
          <Row isTitle itemsCenter>
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
              <View ref={contractAddressRef}>
                <Values.Address address={requireData.id} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={contractAddressRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.protocol')}
              </Text>
            </SubRow>
            <SubRow>
              <ProtocolListItem protocol={requireData.protocol} />
            </SubRow>
          </SubCol>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.hasInteraction')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.Interacted value={requireData.hasInteraction} />
            </SubRow>
          </SubCol>
          {isInWhitelist && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.myMark')}
                </Text>
              </SubRow>
              <SubRow>
                <Text style={commonStyle.rowTitleText}>
                  {t('page.signTx.trusted')}
                </Text>
              </SubRow>
            </SubCol>
          )}
          <SecurityListItem
            title={t('page.signTx.myMark')}
            id="1135"
            engineResult={engineResultMap['1135']}
            forbiddenText={t('page.signTx.markAsBlock')}
          />
          <SecurityListItem
            title={t('page.signTx.myMark')}
            id="1137"
            engineResult={engineResultMap['1137']}
            warningText={t('page.signTx.markAsBlock')}
          />
        </SubTable>
      </Table>
    </View>
  );
};

export default AddLiquidity;
