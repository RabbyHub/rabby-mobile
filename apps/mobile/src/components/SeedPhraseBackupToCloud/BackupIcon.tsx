import { Image, StyleSheet, Text, View } from 'react-native';
import { IS_IOS } from '@/core/native/utils';
import React from 'react';
import { CircleSnail } from 'react-native-progress';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import BackupErrorSVG from '@/assets/icons/address/backup-error.svg';
import BackupInfoSVG from '@/assets/icons/address/backup-info.svg';
import BackupLockSVG from '@/assets/icons/address/backup-lock.svg';
import BackupSuccessSVG from '@/assets/icons/address/backup-success.svg';
import BackupUploadSVG from '@/assets/icons/address/backup-upload.svg';

interface Props {
  status: 'success' | 'error' | 'unlock' | 'running' | 'info';
  isGray?: boolean;
  description?: string;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    progress: {
      position: 'absolute',
      top: -15,
      left: -15,
    },
    statusIcon: {
      width: 28,
      height: 28,
      position: 'absolute',
      bottom: -4,
      right: -4,
    },
    cloudIcon: {
      width: 80,
      height: 80,
    },
    root: {
      position: 'relative',
      alignItems: 'center',
    },
    description: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      fontWeight: '500',
      marginTop: 42,
    },
    iconWrapper: {
      position: 'relative',
    },
  });

export const BackupIcon: React.FC<Props> = ({
  status,
  isGray,
  description,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const CloudImageSrc = React.useMemo(() => {
    if (IS_IOS) {
      return isGray
        ? require('@/assets/icons/address/icloud-gray.png')
        : require('@/assets/icons/address/icloud.png');
    }
    return isGray
      ? require('@/assets/icons/address/icloud-gray.png')
      : require('@/assets/icons/address/icloud.png');
  }, [isGray]);
  const StatusIcon = React.useMemo(() => {
    switch (status) {
      case 'success':
        return BackupSuccessSVG;
      case 'error':
        return BackupErrorSVG;
      case 'unlock':
        return BackupLockSVG;
      case 'running':
        return BackupUploadSVG;
      case 'info':
      default:
        return BackupInfoSVG;
    }
  }, [status]);

  return (
    <View style={styles.root}>
      <View style={styles.iconWrapper}>
        <Image style={styles.cloudIcon} source={CloudImageSrc} />
        <StatusIcon style={styles.statusIcon} />
        {status === 'running' && (
          <CircleSnail
            color={[colors['blue-default']]}
            size={110}
            style={styles.progress}
          />
        )}
      </View>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
};
