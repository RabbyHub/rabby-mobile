import React from 'react';
import { useTranslation } from 'react-i18next';
import { Col, Row, Table } from '../Actions/components/Table';
import { TypedDataActionData } from './utils';
import * as Values from '../Actions/components/Values';
import LogoWithText from '../Actions/components/LogoWithText';
import { Text, View } from 'react-native';
import DescItem from '../Actions/components/DescItem';

const CoboSafeModificationRule = ({
  data,
}: {
  data: TypedDataActionData['coboSafeModificationRole'];
}) => {
  const { t } = useTranslation();
  const actionData = data!;

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text>
              {t('page.signTx.coboSafeModificationRole.safeWalletTitle')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.multisig_id} />
            </View>
            <View className="desc-list">
              <DescItem>
                <Values.AddressMemo address={actionData.multisig_id} />
              </DescItem>
              <DescItem>
                <LogoWithText
                  logo={require('@/assets/icons/wallet/safe.svg')}
                  text="Safe"
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
              </DescItem>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>
              {t('page.signTx.coboSafeModificationRole.descriptionTitle')}
            </Text>
          </Row>
          <Row>
            <Text>{actionData.desc}</Text>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default CoboSafeModificationRule;
