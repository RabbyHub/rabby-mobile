import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ProtocolListItem } from './Actions/components/ProtocolListItem';
import { SecurityListItem } from './Actions/components/SecurityListItem';
import ViewMore from './Actions/components/ViewMore';
import { ContractRequireData } from './TypedDataActions/utils';
import { Col, Row, Table } from './Actions/components/Table';
import * as Values from './Actions/components/Values';
import { Chain } from '@/constant/chains';
import { useApprovalSecurityEngine } from '../hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import DescItem from './Actions/components/DescItem';
import { StyleSheet, Text, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import useCommonStyle from '../hooks/useCommonStyle';
import { ContractCallRequireData } from './Actions/utils';

const { isSameAddress } = addressUtils;

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    rowTitle: {
      width: 100,
    },
    description: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
  });

type CommonActions = {
  title: string;
  desc: string;
  is_asset_changed: boolean;
  is_involving_privacy: boolean;
};

export const CommonAction = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: CommonActions;
  requireData?: ContractRequireData;
  chain?: Chain;
  engineResults: Result[];
}) => {
  const { t } = useTranslation();
  const actionData = data!;
  const {
    userData: { contractWhitelist },
    init,
  } = useApprovalSecurityEngine();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const commonStyle = useCommonStyle();

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain?.serverId &&
        isSameAddress(item.address, requireData?.id ?? ''),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractWhitelist, requireData]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  React.useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Table>
      {requireData && chain ? (
        <Col>
          <Row style={styles.rowTitle} isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.common.interactContract')}
            </Text>
          </Row>
          <Row>
            <Values.Address address={requireData.id} chain={chain} />
            <DescItem>
              <ProtocolListItem protocol={requireData.protocol} />
            </DescItem>
            <DescItem>
              <Values.Interacted value={requireData.hasInteraction} />
            </DescItem>

            {isInWhitelist && (
              <DescItem>
                <Text>{t('page.signTx.markAsTrust')}</Text>
              </DescItem>
            )}

            <SecurityListItem
              id="1135"
              engineResult={engineResultMap['1135']}
              forbiddenText={t('page.signTx.markAsBlock')}
            />

            <SecurityListItem
              id="1137"
              engineResult={engineResultMap['1137']}
              warningText={t('page.signTx.markAsBlock')}
            />
            <DescItem>
              <ViewMore
                type="contract"
                data={{
                  hasInteraction: requireData.hasInteraction,
                  bornAt: requireData.bornAt,
                  protocol: requireData.protocol,
                  rank: requireData.rank,
                  address: requireData.id,
                  chain,
                }}
              />
            </DescItem>
          </Row>
        </Col>
      ) : null}
      <Col>
        <Row style={styles.rowTitle} isTitle>
          <Text style={commonStyle.rowTitleText}>
            {t('page.signTx.common.description')}
          </Text>
        </Row>
        <Row style={styles.description}>
          <Text>{actionData.desc}</Text>
        </Row>
      </Col>
      {(requireData as ContractCallRequireData)?.unexpectedAddr && (
        <Col>
          <Row isTitle style={styles.rowTitle}>
            <Text>{t('page.signTx.contractCall.suspectedReceiver')}</Text>
          </Row>
          <Row>
            <View>
              <Values.Address
                address={
                  (requireData as ContractCallRequireData).unexpectedAddr!
                    .address
                }
                chain={chain}
              />
              <DescItem>
                <Values.AddressMemo
                  address={
                    (requireData as ContractCallRequireData).unexpectedAddr!
                      .address
                  }
                />
              </DescItem>
              {(requireData as ContractCallRequireData).unexpectedAddr!
                .name && (
                <DescItem>
                  <Text>
                    {
                      (requireData as ContractCallRequireData).unexpectedAddr!
                        .name
                    }
                  </Text>
                </DescItem>
              )}
              <DescItem>
                <ViewMore
                  type="receiver"
                  data={{
                    title: t('page.signTx.contractCall.suspectedReceiver'),
                    address: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.address,
                    chain: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.chain,
                    eoa: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.eoa,
                    cex: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.cex,
                    contract: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.contract,
                    usd_value: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.usd_value,
                    hasTransfer: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.hasTransfer,
                    isTokenContract: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.isTokenContract,
                    name: (requireData as ContractCallRequireData)
                      .unexpectedAddr!.name,
                    onTransferWhitelist: (
                      requireData as ContractCallRequireData
                    ).unexpectedAddr!.onTransferWhitelist,
                  }}
                />
              </DescItem>
            </View>
          </Row>
        </Col>
      )}
    </Table>
  );
};
