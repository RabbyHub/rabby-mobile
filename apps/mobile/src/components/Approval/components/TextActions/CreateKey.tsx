import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreateKeyAction } from '@rabby-wallet/rabby-api/dist/types';
import { Col, Row, Table } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { Text, View } from 'react-native';
import useCommonStyle from '../../hooks/useCommonStyle';

const CreateKey = ({
  data,
}: {
  data: CreateKeyAction;
  engineResults: Result[];
}) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signText.createKey.interactDapp')}
            </Text>
          </Row>
          <Row>
            <Values.Protocol
              value={data.protocol}
              textStyle={commonStyle.primaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signText.createKey.description')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>{data.desc}</Text>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default CreateKey;
