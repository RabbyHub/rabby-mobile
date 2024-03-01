import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PushMultiSigAction } from '@rabby-wallet/rabby-api/dist/types';
import { Col, Row, Table } from './components/Table';
import * as Values from './components/Values';
import { Chain } from '@/constant/chains';
import { PushMultiSigRequireData } from './utils';
import LogoWithText from './components/LogoWithText';
import useCommonStyle from '../../hooks/useCommonStyle';
import DescItem from './components/DescItem';

const PushMultiSig = ({
  data,
  requireData,
  chain,
}: {
  data: PushMultiSigAction;
  requireData: PushMultiSigRequireData;
  chain: Chain;
}) => {
  const commonStyle = useCommonStyle();
  const { t } = useTranslation();
  const multiSigInfo = useMemo(() => {
    const contract = requireData.contract?.[chain.serverId];
    if (contract) {
      return contract.multisig;
    }
  }, [requireData, chain]);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.submitMultisig.multisigAddress')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={data.multisig_id} chain={chain} />
              <View>
                <DescItem>
                  <Values.AddressMemo address={data.multisig_id} />
                </DescItem>
                {multiSigInfo && (
                  <DescItem>
                    <LogoWithText
                      logo={multiSigInfo.logo_url}
                      text={multiSigInfo.name}
                      logoSize={14}
                      logoRadius={14}
                      textStyle={{
                        fontWeight: 'normal',
                        fontSize: 13,
                        lineHeight: 15,
                        color: '#4B4D59',
                      }}
                    />
                  </DescItem>
                )}
              </View>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default PushMultiSig;
