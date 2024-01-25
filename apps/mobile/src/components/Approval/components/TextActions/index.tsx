import { Result } from '@rabby-wallet/rabby-security-engine';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TextActionData, getActionTypeText } from './utils';
import CreateKey from './CreateKey';
import VerifyAddress from './VerifyAddress';
import { NoActionAlert } from '../NoActionAlert/NoActionAlert';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Tip } from '@/components/Tip';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import IconQuestionMark from '@/assets/icons/sign/question-mark-24.svg';
import IconRabbyDecoded from '@/assets/icons/sign/rabby-decoded.svg';
import RcIconCheck from '@/assets/icons/approval/icon-check.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import ViewRawModal from '../TxComponents/ViewRawModal';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    signTitle: {
      justifyContent: 'space-between',
      marginBottom: 15,
      flexDirection: 'row',
      marginTop: 15,
    },
    signTitleLeft: {
      fontSize: 18,
      lineHeight: 21,
      color: colors['neutral-title-1'],
    },
    signTitleRight: {
      flexDirection: 'row',
    },
    iconSpeedup: {
      width: 10,
      marginRight: 6,
    },
    viewRawText: {
      fontSize: 12,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },
    viewRawIcon: {
      width: 16,
      height: 16,
      color: colors['neutral-foot'],
    },
    actionWrapper: {
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: colors['neutral-card-1'],
    },
    actionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      flexDirection: 'row',
      backgroundColor: colors['blue-default'],
      padding: 13,
      alignItems: 'center',
      borderTopRightRadius: 8,
      borderTopLeftRadius: 8,
    },
    isUnknown: {
      backgroundColor: colors['neutral-foot'],
    },
    actionHeaderLeft: {
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 19,
      color: colors['neutral-title-2'],
    },
    actionHeaderRight: {
      fontSize: 14,
      lineHeight: 16,
      position: 'relative',
    },
    tipContent: {
      maxWidth: 358,
      padding: 12,
      alignItems: 'center',
      flexDirection: 'row',
    },
    tipContentIcon: {
      width: 12,
      height: 12,
      marginRight: 4,
    },
    icon: {
      width: 24,
      height: 24,
    },
    container: {
      padding: 14,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
    },
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
    indicator: {
      backgroundColor: colors['blue-default'],
      color: colors['blue-default'],
    },
    indicatorText: {
      color: colors['blue-default'],
    },
  });

const Actions = ({
  data,
  engineResults,
  raw,
  message,
  origin,
}: {
  data: TextActionData | null;
  engineResults: Result[];
  raw: string;
  message: string;
  origin: string;
}) => {
  const actionName = useMemo(() => {
    return getActionTypeText(data);
  }, [data]);

  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const handleViewRawClick = () => {
    ViewRawModal.open({
      raw: raw as any,
    });
  };

  return (
    <View>
      <View style={styles.signTitle}>
        <Text style={styles.signTitleLeft}>{t('page.signText.title')}</Text>
        <TouchableOpacity
          style={styles.signTitleRight}
          onPress={handleViewRawClick}>
          <Text style={styles.viewRawText}>{t('page.signTx.viewRaw')}</Text>
          <RcIconArrowRight style={styles.viewRawIcon} />
        </TouchableOpacity>
      </View>
      <View style={styles.actionWrapper}>
        <View
          style={StyleSheet.flatten([
            styles.actionHeader,
            data ? {} : styles.isUnknown,
          ])}>
          <Text style={styles.actionHeaderLeft}>{actionName}</Text>
          <View style={styles.actionHeaderRight}>
            <Tip
              placement="bottom"
              isLight
              content={
                !data ? (
                  <NoActionAlert
                    data={{
                      origin,
                      text: message,
                    }}
                  />
                ) : (
                  <View style={styles.tipContent}>
                    <RcIconCheck style={styles.tipContentIcon} />
                    <Text>{t('page.signTx.decodedTooltip')}</Text>
                  </View>
                )
              }>
              {!data ? (
                <IconQuestionMark style={styles.icon} />
              ) : (
                <IconRabbyDecoded style={styles.icon} />
              )}
            </Tip>
          </View>
        </View>
        {data && (
          <View style={styles.container}>
            {data.createKey && (
              <CreateKey data={data.createKey} engineResults={engineResults} />
            )}
            {data.verifyAddress && (
              <VerifyAddress
                data={data.verifyAddress}
                engineResults={engineResults}
              />
            )}
          </View>
        )}
      </View>
      <View>
        <View style={styles.messageTitleWrapper}>
          <Text style={styles.messageTitle}>{t('page.signText.message')}</Text>
          <View style={styles.messageTitleLine} />
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
