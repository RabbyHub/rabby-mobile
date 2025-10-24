import { Result } from '@rabby-wallet/rabby-security-engine';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getActionTypeText } from './utils';
import CreateKey from './CreateKey';
import VerifyAddress from './VerifyAddress';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tip } from '@/components/Tip';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24-cc.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import ViewRawModal from '../TxComponents/ViewRawModal';
import { CommonAction } from '../CommonAction';
import { Card } from '../Actions/components/Card';
import { OriginInfo } from '../OriginInfo';
import { Divide } from '../Actions/components/Divide';
import { getActionsStyle } from '../Actions';
import { ParsedTextActionData } from '@rabby-wallet/rabby-action';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Account } from '@/core/services/preference';

export const getMessageStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    messageContent: {
      padding: 16,
      height: 320,
      paddingTop: 0,
    },
    messageText: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
    messageTitle: {
      marginVertical: 12,
      position: 'relative',
      alignItems: 'center',
    },
    dashLine: {
      position: 'absolute',
      color: colors['neutral-line'],
    },
    messageTitleText: {
      fontSize: 14,
      color: colors['blue-default'],
      fontWeight: '500',
      paddingHorizontal: 10,
      textAlign: 'center',
      zIndex: 1,
      backgroundColor: colors['neutral-card-1'],
    },
    noAction: {},
    messageCard: {
      marginTop: 12,
    },
    testnetMessage: {
      padding: 15,
      fontSize: 13,
      flexWrap: 'wrap',
      lineHeight: 16,
      color: colors['neutral-body'],
      height: 260,
      fontWeight: '500',
    },
  });

const Actions = ({
  data,
  engineResults,
  raw,
  message,
  origin,
  originLogo,
  account,
}: {
  data: ParsedTextActionData | null;
  engineResults: Result[];
  raw: string;
  message: string;
  origin: string;
  originLogo?: string;
  account: Account;
}) => {
  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);

  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getMessageStyles(colors), [colors]);
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
      <Card style={styles.messageCard}>
        <BottomSheetScrollView
          nestedScrollEnabled
          style={StyleSheet.flatten([
            styles.messageContent,
            data ? {} : styles.noAction,
          ])}>
          <View style={styles.messageTitle}>
            <Text
              style={styles.dashLine}
              ellipsizeMode="clip"
              accessible={false}
              numberOfLines={1}>
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
              - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
            </Text>

            <Text style={styles.messageTitleText}>
              {t('page.signText.title')}
            </Text>
          </View>
          <Text style={styles.messageText}>{message}</Text>
        </BottomSheetScrollView>
      </Card>
    </View>
  );
};

export default Actions;
