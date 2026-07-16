import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { toggleFeedbackHistoryVisible } from '../hooks';

import RcChatCC from '@/assets/icons/feedback/chat-cc.svg';

import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { makeDeviceUUID } from '@/core/apis/device';
import { openapi } from '@/core/request';
import { FontWeightEnum } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useCreation, useRequest } from 'ahooks';

export function FeedbackHistoryHeaderEntry({ style }: RNViewProps) {
  const { styles } = useTheme2024({ getStyle });

  const deviceId = useCreation(() => {
    return makeDeviceUUID().deviceUUID;
  }, []);

  const { data, mutate } = useRequest(
    async () => {
      return openapi.getClientFeedbackUnread({
        device_id: deviceId,
      });
    },
    {
      pollingInterval: 10 * 1000,
    },
  );

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.iconContainer, style]}
        onPress={() => {
          toggleFeedbackHistoryVisible(true);
          mutate(prev => {
            if (prev) {
              return {
                ...prev,
                unread_count: 0,
              };
            }
            return prev;
          });
        }}>
        <View style={styles.chatIconContainer}>
          {data?.unread_count ? <View style={styles.dot} /> : null}
          <RcChatCC style={styles.icon} color={styles.icon.color} />
        </View>
      </TouchableOpacity>
    </>
  );
}

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  iconContainer: {
    height: '100%',
  },

  icon: {
    width: 20,
    height: 20,
    color: colors2024['neutral-title-1'],
  },
  chatIconContainer: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors2024['red-default'],
    width: 4,
    height: 4,
    borderRadius: 1000,
  },

  mainContainer: {
    height: '100%',
    maxHeight: 380,
  },
  container: {
    flex: 1,
  },
  titleContainer: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: FontWeightEnum.heavy,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  stagesContainer: {
    flexDirection: 'column',
    position: 'relative',
    width: '100%',
    paddingHorizontal: 32,
    height: '100%',
    maxHeight: 320,
    // ...makeDebugBorder('green'),
  },

  stage: {
    position: 'relative',
    paddingLeft: 18,
    borderLeftColor: colors2024['brand-default'],
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    width: '100%',
    paddingBottom: 22,
    // ...makeDebugBorder('yellow'),
  },
  lastStage: {
    borderLeftWidth: 0,
  },
  stagePointContainer: {
    width: 16,
    height: 16,
    borderRadius: 16,
    flexShrink: 0,
    position: 'absolute',
    backgroundColor: colors2024['brand-default'],
    left: -8,
    top: 0,
  },
  stagePointIcon: {
    width: 16,
    height: 16,
  },
  stageTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: 700,
    lineHeight: 22,
    flexShrink: 0,
    top: -2,
  },
  stageContent: {
    marginTop: 12,
    flexShrink: 1,
    // height: '100%',
  },

  contentWrapper: {
    marginLeft: -2,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-2'],
    width: '100%',
    padding: 12,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  descText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: 500,
    lineHeight: 16,
  },
  feedbackDesc: {
    marginBottom: 8,
  },
  feedbackImage: {
    height: 96,
    width: 96,
  },
}));

function FooterComponent({
  onPress,
  style,
}: RNViewProps & { onPress?(): void }) {
  const { styles } = useTheme2024({ getStyle: getFooterComponentStyle });
  const { t } = useTranslation();

  return (
    <View style={[styles.footerContainer, style]}>
      <Button
        title={t('global.ok')}
        containerStyle={styles.okButtonContainer}
        height={BOTTOM_BUTTON_SINGLE_HEIGHT}
        titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
        type="primary"
        onPress={onPress}
      />
    </View>
  );
}

const getFooterComponentStyle = createGetStyles2024(({ safeAreaInsets }) => {
  return {
    footerContainer: {
      width: '100%',
      paddingHorizontal: 20,
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    },
    okButtonContainer: {
      width: '100%',
    },
  };
});
