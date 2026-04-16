import React from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import RcArrowRight2CC from '@/assets/icons/common/right-2-cc.svg';

// Background image for the backup reminder card
import backupBgImage from '@/assets/icons/backup/backup-reminder-bg.png';

export interface BackupReminderCardProps {
  /**
   * Whether to show the backup reminder card
   */
  visible?: boolean;
  /**
   * Current account info for navigation to AddressDetail
   */
  account?: {
    address: string;
    type: string;
    brandName: string;
  } | null;
  /**
   * Custom style for the container
   */
  style?: any;
}

export const BackupReminderCard: React.FC<BackupReminderCardProps> = ({
  visible = false,
  account,
  style,
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const navigation = useRabbyAppNavigation();

  const handlePress = React.useCallback(() => {
    if (account) {
      navigation.navigate(RootNames.Backup, {
        address: account.address,
        type: account.type,
        brandName: account.brandName,
      });
    }
  }, [navigation, account]);

  if (!visible) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.7}>
      {/* Background image */}
      <Image
        source={backupBgImage as ImageSourcePropType}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      {/* Content overlay */}
      <View style={styles.contentContainer}>
        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={2}>
            {t('backupReminder.title', 'You have not backed up your wallet')}
          </Text>
          <View style={styles.actionRow}>
            <Text style={styles.actionText}>
              {t('backupReminder.action', 'Back up now')}
            </Text>
            <RcArrowRight2CC
              width={16}
              height={16}
              color={colors2024['brand-default']}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 106,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-line'],
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  titleText: {
    width: 188,
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  actionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['brand-default'],
  },
}));

export default BackupReminderCard;
