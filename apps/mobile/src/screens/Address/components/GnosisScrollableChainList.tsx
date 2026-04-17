import { Text } from '@/components';
import { Chain } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import FastImage from 'react-native-fast-image';

type RNViewProps = {
  style?: import('react').ComponentProps<typeof View>['style'];
  className?: string;
};

export const GnosisScrollableChainList = ({
  data,
  style,
}: {
  data: Chain[];
} & RNViewProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();

  return (
    <View style={[styles.chainListContainer, style]}>
      <Text style={styles.chainListDesc}>
        {t('page.importSafe.gnosisChainScrollDesc', {
          count: data?.length,
        })}
      </Text>
      <ScrollView
        style={styles.chainListScroll}
        contentContainerStyle={styles.chainListContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        scrollEventThrottle={16}>
        <View style={styles.chainList}>
          {data?.map(chain => {
            return (
              <View style={styles.chainPill} key={chain.id}>
                <FastImage
                  style={styles.chainLogo}
                  source={{
                    uri: chain.logo,
                    priority: FastImage.priority.low,
                  }}
                  resizeMode={FastImage.resizeMode.contain}
                />
                <Text style={styles.chainName}>{chain.name}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  chainListContainer: {
    marginTop: 16,
    flex: 1,
  },
  chainListDesc: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  chainListScroll: {
    width: '100%',
    flex: 1,
  },
  chainListContent: {
    paddingBottom: 8,
  },
  chainList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    borderRadius: 8,
    padding: 6,
    height: 32,
    marginRight: 8,
    marginBottom: 8,
  },
  chainLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 6,
  },
  chainName: {
    fontSize: 14,
    fontWeight: '500',
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
}));
