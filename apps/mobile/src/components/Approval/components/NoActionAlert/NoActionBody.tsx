import IconEmail from '@/assets/icons/add-chain/email.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { noop } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  isRequested?: boolean;
  requestedCount: number;
  isRequesting?: boolean;
  handleRequest(): void;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    line: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
      width: '100%',
      marginVertical: 12,
    },
    text: {
      color: colors['neutral-foot'],
      lineHeight: 16,
      textAlign: 'center',
    },
    buttonText: {
      columnGap: 6,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
  });

export const NoActionBody: React.FC<Props> = ({
  isRequested,
  requestedCount,
  isRequesting,
  handleRequest,
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View>
      <View style={styles.line} />
      <View>
        {isRequested ? (
          <Text style={styles.text}>
            {requestedCount > 1
              ? t('page.switchChain.requestsReceivedPlural', {
                  count: requestedCount,
                })
              : t('page.switchChain.requestsReceived')}
          </Text>
        ) : (
          <TouchableOpacity
            // eslint-disable-next-line react-native/no-inline-styles
            style={[styles.buttonText, { opacity: isRequesting ? 0.7 : 1 }]}
            onPress={isRequesting ? noop : handleRequest}>
            {<IconEmail className="w-16" />}
            <Text className="text-r-blue-default">
              {t('page.switchChain.requestRabbyToSupport')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
