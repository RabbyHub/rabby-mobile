import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@debank/common';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ApproveNFTRequireData, ParsedActionData } from './utils';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import { ProtocolListItem } from './components/ProtocolListItem';
import { SecurityListItem } from './components/SecurityListItem';
import ViewMore from './components/ViewMore';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import DescItem from './components/DescItem';

const ApproveNFTCollection = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['approveNFTCollection'];
  requireData: ApproveNFTRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const { init } = useApprovalSecurityEngine();

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  useEffect(() => {
    init();
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.nftCollectionApprove.approveCollection')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>
              {actionData?.collection?.name || '-'}
            </Text>
            <View>
              <DescItem>
                <ViewMore
                  type="collection"
                  data={{
                    collection: actionData.collection,
                    chain,
                  }}
                />
              </DescItem>
            </View>
          </Row>
        </Col>

        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveTo')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.spender} chain={chain} />
            </View>
            <View>
              <ProtocolListItem protocol={requireData.protocol} />

              <SecurityListItem
                id="1053"
                engineResult={engineResultMap['1053']}
                dangerText={
                  <Text>{t('page.signTx.tokenApprove.eoaAddress')}</Text>
                }
              />

              <SecurityListItem
                id="1056"
                engineResult={engineResultMap['1056']}
                warningText={
                  <Values.Interacted
                    value={false}
                    textStyle={commonStyle.secondaryText}
                  />
                }
                defaultText={
                  <Values.Interacted
                    value={requireData.hasInteraction}
                    textStyle={commonStyle.secondaryText}
                  />
                }
              />

              <SecurityListItem
                id="1054"
                engineResult={engineResultMap['1054']}
                dangerText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.tokenApprove.trustValueLessThan', {
                      value: '$10,000',
                    })}
                  </Text>
                }
                warningText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.tokenApprove.trustValueLessThan', {
                      value: '$100,000',
                    })}
                  </Text>
                }
              />

              <SecurityListItem
                id="1055"
                engineResult={engineResultMap['1055']}
                warningText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.tokenApprove.deployTimeLessThan', {
                      value: '3',
                    })}
                  </Text>
                }
              />

              <SecurityListItem
                id="1060"
                engineResult={engineResultMap['1060']}
                dangerText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.tokenApprove.flagByRabby')}
                  </Text>
                }
              />

              <SecurityListItem
                id="1134"
                engineResult={engineResultMap['1134']}
                forbiddenText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.markAsBlock')}
                  </Text>
                }
              />

              <SecurityListItem
                id="1136"
                engineResult={engineResultMap['1136']}
                warningText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.markAsBlock')}
                  </Text>
                }
              />

              <SecurityListItem
                id="1133"
                engineResult={engineResultMap['1133']}
                safeText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.markAsTrust')}
                  </Text>
                }
              />

              <DescItem>
                <ViewMore
                  type="nftSpender"
                  data={{
                    ...requireData,
                    spender: actionData.spender,
                    chain,
                  }}
                />
              </DescItem>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default ApproveNFTCollection;
