import { AssetAvatar } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { RcIconWarningCircleCC } from '@/assets2024/icons/common';

export const DappActionHeader = ({
  logo,
  chain,
  title,
  showQueueDesc,
}: {
  logo?: string;
  chain?: string;
  title?: string;
  showQueueDesc?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <View style={styles.logoContainer}>
          <AssetAvatar
            style={styles.logo}
            size={40}
            chainSize={14}
            logo={logo}
            chain={chain}
          />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      {!!showQueueDesc && (
        <View style={styles.descriptionContainer}>
          <RcIconWarningCircleCC
            width={18}
            height={18}
            color={colors2024['brand-default']}
          />
          <Text style={styles.description}>
            {t('page.defiDetail.dappActions.queueDescription')}
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    color: colors2024['red-default'],
    width: '100%',
    marginBottom: 24,
  },
  titleContainer: {
    alignItems: 'center',
    gap: 6,
  },
  logoContainer: {
    width: 40,
    height: 40,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  descriptionContainer: {
    marginTop: 15,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors2024['brand-light-1'],
    flexDirection: 'row',
    gap: 2,
  },
  description: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
  },
}));
