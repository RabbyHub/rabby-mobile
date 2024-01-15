import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SignMultiSigActions } from '@rabby-wallet/rabby-api/dist/types';
import { Col, Row, Table } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import { MultiSigRequireData } from './utils';
import LogoWithText from '../Actions/components/LogoWithText';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Chain } from '@debank/common';
import { CHAINS } from '@/constant/chains';
import { Text, View } from 'react-native';

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
            <Text>{t('page.signTx.submitMultisig.multisigAddress')}</Text>
          </Row>
          <Row>
            <View>
              <Values.Address
                address={data.multisig_id}
                chain={multiSigInfo?.chain}
              />
              <View className="desc-list">
                <View>
                  <Values.AddressMemo address={data.multisig_id} />
                </View>
                {multiSigInfo && (
                  <View>
                    <LogoWithText
                      logo={multiSigInfo.logo_url}
                      text={multiSigInfo.name}
                      logoSize={14}
                      logoRadius={16}
                      // eslint-disable-next-line react-native/no-inline-styles
                      textStyle={{
                        fontWeight: 'normal',
                        fontSize: 13,
                        lineHeight: 15,
                        color: '#4B4D59',
                      }}
                    />
                  </View>
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
