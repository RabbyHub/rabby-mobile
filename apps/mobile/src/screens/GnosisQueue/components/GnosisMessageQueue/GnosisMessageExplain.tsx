import { getActionTypeText } from '@/components/Approval/components/TextActions/utils';
import { getActionTypeText as getActionTypedDataTypeText } from '@/components/Approval/components/TypedDataActions/utils';
import { Button } from '@/components/Button';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { openapi } from '@/core/request';
import { useThemeColors } from '@/hooks/theme';
import { RcIconUnknown } from '@/screens/Approvals/icons';
import { createGetStyles } from '@/utils/styles';
import type { SafeMessage } from '@rabby-wallet/gnosis-sdk';
import { parseAction } from '@rabby-wallet/rabby-action';
import { Skeleton } from '@rneui/themed';
import { useRequest } from 'ahooks';
import { isString } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

interface Props {
  data: SafeMessage;
  onView(): void;
  isViewLoading?: boolean;
}

export const GnosisMessageExplain: React.FC<Props> = ({
  onView,
  data,
  isViewLoading,
}) => {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);

  const { data: content, loading } = useRequest(
    async () => {
      if (isString(data.message)) {
        const res = await openapi.parseText({
          text: data.message,
          origin: INTERNAL_REQUEST_ORIGIN,
          address: data.safe,
        });

        const parsed = parseAction({
          type: 'text',
          data: res.action,
          text: data.message,
          sender: data.safe,
        });

        return getActionTypeText(parsed);
      }
      const res = await openapi.parseTypedData({
        typedData: data.message,
        origin: INTERNAL_REQUEST_ORIGIN,
        address: data.safe,
      });

      const parsed = parseAction({
        type: 'typed_data',
        data: res.action as any,
        typedData: data.message,
        sender: data.safe,
      });

      return getActionTypedDataTypeText(parsed);
    },
    {
      refreshDeps: [data.message, data.safe],
      cacheKey: `getActionTypeText-${data.message}-${data.safe}`,
      staleTime: 30 * 1000,
    },
  );

  if (loading) {
    return <Skeleton width={'100%'} height={25} />;
  }

  return (
    <View style={styles.container}>
      <RcIconUnknown style={styles.icon} />
      <View style={styles.content}>
        <Text style={styles.explainText}>
          {content || t('page.safeQueue.unknownTx')}
        </Text>
      </View>
      <Button
        title={t('page.safeQueue.viewBtn')}
        loading={isViewLoading}
        onPress={onView}
        containerStyle={styles.buttonContainer}
        buttonStyle={[styles.button, styles.buttonCanExec]}
        titleStyle={[styles.buttonTitle, styles.buttonTitleCanExec]}
      />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  content: {
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    marginLeft: 'auto',
  },
  button: {
    borderRadius: 2,
    width: 60,
    height: 26,
  },
  buttonCanExec: {
    backgroundColor: 'rgba(134, 151, 255, 0.2)',
  },
  buttonTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  buttonTitleCanExec: {
    color: colors['blue-default'],
  },
  explainText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 18,
    color: colors['neutral-title-1'],
  },
}));
