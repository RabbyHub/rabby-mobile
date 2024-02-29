import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SignMultiSigActions } from '@rabby-wallet/rabby-api/dist/types';
import { Col, Row, Table } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import { MultiSigRequireData } from './utils';
import LogoWithText from '../Actions/components/LogoWithText';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Chain } from '@/constant/chains';
import { CHAINS } from '@/constant/chains';
import { Text, View } from 'react-native';
import DescItem from '../Actions/components/DescItem';
import useCommonStyle from '../../hooks/useCommonStyle';

const PushMultiSig = ({
  data,
  requireData,
  chain,
}: {
  data: SignMultiSigActions;
  requireData: MultiSigRequireData;
  chain?: Chain;
  engineResults: Result[];
}) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();

  const multiSigInfo = useMemo(() => {
    if (!chain) {
      for (const key in requireData?.contract) {
        const contract = requireData.contract[key];
        const c = Object.values(CHAINS).find(item => item.serverId === key);
        if (contract.multisig && c) {
          return {
            ...contract.multisig,
            chain: c,
          };
        }
      }
    } else {
      const contract = requireData.contract?.[chain.serverId];
      if (contract) {
        return { ...contract.multisig, chain };
      }
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
              <Values.Address
                address={data.multisig_id}
                chain={multiSigInfo?.chain}
              />
              <View>
                <DescItem>
                  <Values.AddressMemo
                    address={data.multisig_id}
                    textStyle={commonStyle.secondaryText}
                  />
                </DescItem>
                {multiSigInfo && (
                  <DescItem>
                    <LogoWithText
                      logo={multiSigInfo.logo_url}
                      text={multiSigInfo.name}
                      logoSize={14}
                      logoRadius={16}
                      textStyle={commonStyle.secondaryText}
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
