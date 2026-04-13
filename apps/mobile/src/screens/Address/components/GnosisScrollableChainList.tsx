import { Text } from '@/components';
import { Chain } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';

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
        showsVerticalScrollIndicator={false}>
        <View style={styles.chainList}>
          {data?.map(chain => {
            return (
              <View style={styles.chainPill} key={chain.id}>
                <Image source={{ uri: chain.logo }} style={styles.chainLogo} />
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
    alignItems: 'center',
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
    maxHeight: 300,
    width: '100%',
  },
  chainListContent: {
    paddingBottom: 8,
  },
  chainList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    borderRadius: 8,
    padding: 6,
    height: 32,
  },
  chainLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  chainName: {
    fontSize: 14,
    fontWeight: '500',
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
}));
