import type { Result } from '@rabby-wallet/rabby-security-engine';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getActionTypeText } from './utils';
import CreateKey from './CreateKey';
import VerifyAddress from './VerifyAddress';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Tip } from '@/components/Tip';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import ViewRawModal from '../TxComponents/ViewRawModal';
import { CommonAction } from '../CommonAction';
import { Card } from '../Actions/components/Card';
import { OriginInfo } from '../OriginInfo';
import { Divide } from '../Actions/components/Divide';
import { getActionsStyle } from '../Actions/styles';
import type { ParsedTextActionData } from '@rabby-wallet/rabby-action';
import type { Account } from '@/core/startupServices/preference';
import { Text } from '@/components/Typography';
import type { Chain } from '@debank/common';
import type { SignMessageHighlightToken } from '../signMessageTokenizer';
import type { SignMessageAddressDataMap } from '../signMessageAddressData';
import { SignMessageCard } from './SignMessageCard';

export { getMessageStyles } from './styles';

const Actions = ({
  data,
  engineResults,
  raw,
  message,
  origin,
  originLogo,
  account,
  chain,
  messageTokens,
  addressData,
  approvalViewportHeight,
}: {
  data: ParsedTextActionData | null;
  engineResults: Result[];
  raw: string;
  message: string;
  origin: string;
  originLogo?: string;
  account: Account;
  chain?: Chain;
  messageTokens?: SignMessageHighlightToken[];
  addressData?: SignMessageAddressDataMap;
  approvalViewportHeight: number;
}) => {
  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);

  const { t } = useTranslation();
  const { styles: actionStyles } = useTheme2024({
    getStyle: getActionsStyle,
  });

  const handleViewRawClick = () => {
    ViewRawModal.open({
      raw: raw as any,
    });
  };

  const isUnknown = !data;
  return (
    <View>
      <View style={actionStyles.actionWrapper}>
        <Card>
          <OriginInfo
            chain={chain}
            origin={origin}
            originLogo={originLogo}
            engineResults={engineResults}
          />
        </Card>
        <Card>
          <View
            style={{
              ...actionStyles.actionHeader,
              ...(isUnknown ? actionStyles.isUnknown : {}),
            }}>
            <View
              style={StyleSheet.flatten({
                flexDirection: 'row',
                alignItems: 'center',
              })}>
              <Text
                style={StyleSheet.flatten({
                  ...actionStyles.leftText,
                  ...(isUnknown ? actionStyles.isUnknownText : {}),
                })}>
                {actionName}
              </Text>
              {isUnknown && (
                <Tip
                  placement="bottom"
                  isLight
                  content={
                    <NoActionAlert
                      account={account}
                      data={{
                        origin,
                        text: message,
                      }}
                    />
                  }>
                  <IconQuestionMark
                    width={actionStyles.icon.width}
                    height={actionStyles.icon.height}
                    color={actionStyles.icon.color}
                    style={actionStyles.icon}
                  />
                </Tip>
              )}
            </View>
            <TouchableOpacity
              style={actionStyles.signTitleRight}
              onPress={handleViewRawClick}>
              <Text style={actionStyles.viewRawText}>
                {t('page.signTx.viewRaw')}
              </Text>
              <RcIconArrowRight />
            </TouchableOpacity>
          </View>

          {data && <Divide />}

          {data && (
            <View style={actionStyles.container}>
              {data.createKey && (
                <CreateKey
                  data={data.createKey}
                  engineResults={engineResults}
                />
              )}
              {data.verifyAddress && (
                <VerifyAddress
                  data={data.verifyAddress}
                  engineResults={engineResults}
                />
              )}
              {data.common && (
                <CommonAction
                  data={data.common}
                  engineResults={engineResults}
                />
              )}
            </View>
          )}
        </Card>
      </View>
      <SignMessageCard
        title={t('page.signText.title')}
        message={message}
        hasAction={!!data}
        messageTokens={messageTokens}
        chain={chain}
        addressData={addressData}
        account={account}
        approvalViewportHeight={approvalViewportHeight}
      />
    </View>
  );
};

export default Actions;
