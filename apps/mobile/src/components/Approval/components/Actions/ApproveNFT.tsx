import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ApproveNFTRequireData, ParsedActionData } from './utils';
import { Table, Col, Row } from './components/Table';
import NFTWithName from './components/NFTWithName';
import * as Values from './components/Values';
import { SecurityListItem } from './components/SecurityListItem';
import ViewMore from './components/ViewMore';
import { ProtocolListItem } from './components/ProtocolListItem';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import DescItem from './components/DescItem';

const ApproveNFT = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['approveNFT'];
  requireData: ApproveNFTRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const { init } = useApprovalSecurityEngine();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.nftApprove.approveNFT')}
            </Text>
          </Row>
          <Row>
            <NFTWithName nft={actionData?.nft} />
            <View>
              <DescItem>
                <ViewMore
                  type="nft"
                  data={{
                    nft: actionData.nft,
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
            <Values.Address address={actionData.spender} chain={chain} />
            <View>
              {requireData.protocol && (
                <DescItem>
                  <ProtocolListItem
                    protocol={requireData.protocol}
                    style={commonStyle.secondaryText}
                  />
                </DescItem>
              )}

              <SecurityListItem
                id="1043"
                engineResult={engineResultMap['1043']}
                dangerText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.tokenApprove.eoaAddress')}
                  </Text>
                }
              />

              <SecurityListItem
                id="1048"
                engineResult={engineResultMap['1048']}
                warningText={<Values.Interacted value={false} />}
                defaultText={
                  <Values.Interacted
                    value={requireData.hasInteraction}
                    textStyle={commonStyle.secondaryText}
                  />
                }
              />

              <SecurityListItem
                id="1044"
                engineResult={engineResultMap['1044']}
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
                id="1045"
                engineResult={engineResultMap['1045']}
                warningText={
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.tokenApprove.deployTimeLessThan', {
                      value: '3',
                    })}
                  </Text>
                }
              />

              <SecurityListItem
                id="1052"
                engineResult={engineResultMap['1052']}
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

export default ApproveNFT;
