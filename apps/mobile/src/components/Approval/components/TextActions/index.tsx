import { Result } from '@rabby-wallet/rabby-security-engine';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TextActionData, getActionTypeText } from './utils';
import CreateKey from './CreateKey';
import VerifyAddress from './VerifyAddress';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Tip } from '@/components/Tip';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24-cc.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import ViewRawModal from '../TxComponents/ViewRawModal';
import { CommonAction } from '../CommonAction';
import { Card } from '../Actions/components/Card';
import { OriginInfo } from '../OriginInfo';
import { Divide } from '../Actions/components/Divide';
import { getActionsStyle } from '../Actions';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    messageWrapper: {},
    messageTitleWrapper: {
      position: 'relative',
      height: 16,
      marginVertical: 10,
    },
    messageTitle: {
      position: 'relative',
      fontSize: 14,
      lineHeight: 16,
      color: colors['neutral-foot'],
      textAlign: 'center',
      backgroundColor: colors['neutral-bg-2'],
      alignSelf: 'center',
      paddingHorizontal: 12,
    },
    messageTitleLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      top: 6,
      borderStyle: 'dashed',
      borderTopWidth: 1,
      borderColor: colors['neutral-line'],
      zIndex: -1,
    },
    messageContent: {
      padding: 15,
      wordBreak: 'break-all',
      whiteSpace: 'pre-wrap',
      backgroundColor: colors['neutral-card-1'],
      borderColor: colors['neutral-line'],
      borderWidth: 1,
      borderRadius: 6,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '500',
      color: colors['neutral-body'],
      height: 320,
    },
    noAction: {
      backgroundColor: colors['neutral-card-3'],
    },
    tabView: {
      backgroundColor: colors['neutral-card-2'],
      padding: 15,
      marginVertical: 15,
      flex: 1,
    },
    popupView: {
      padding: 15,
      flex: 1,
    },
  });

const Actions = ({
  data,
  engineResults,
  raw,
  message,
  origin,
  originLogo,
}: {
  data: TextActionData | null;
  engineResults: Result[];
  raw: string;
  message: string;
  origin: string;
  originLogo?: string;
}) => {
  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);

  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const actionStyles = getActionsStyle(colors);

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
      <View>
        <View style={styles.messageTitleWrapper}>
          <Text style={styles.messageTitle}>{t('page.signText.message')}</Text>
          <View
            style={StyleSheet.flatten([
              styles.messageTitleLine,
              Platform.select({
                ios: {
                  borderStyle: 'solid',
                },
              }),
            ])}
          />
        </View>
        <ScrollView
          style={StyleSheet.flatten([
            styles.messageContent,
            data ? {} : styles.noAction,
          ])}>
          <Text>{message}</Text>
        </ScrollView>
      </View>
    </View>
  );
};

export default Actions;
