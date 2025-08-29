import { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLatestRepliedFeedbacks, useViewingFeedback } from './hooks';

import RcEntryCC from './icons/entry-cc.svg';
import RcSuccessCC from './icons/success-cc.svg';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSheetModal, useSheetModals } from '@/hooks/useSheetModal';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import AutoLockView from '../AutoLockView';
import { matomoRequestEvent } from '@/utils/analytics';
import { Button } from '@/components2024/Button';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { UserFeedbackItem } from '@rabby-wallet/rabby-api/dist/types';
import { FontWeightEnum } from '@/core/utils/fonts';
import { BottomSheetHandlableView } from '../customized/BottomSheetHandle';

function ModalResponseDetail({
  lastRepliedFeedback,
}: {
  lastRepliedFeedback: UserFeedbackItem;
}) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const { viewingFeedback, finishViewFeedback } = useViewingFeedback();

  useEffect(() => {
    if (viewingFeedback) {
      toggleShowSheetModal(true);
    } else {
      toggleShowSheetModal('destroy');
    }
  }, [viewingFeedback, toggleShowSheetModal]);

  const { imageUri, content, comment } = useMemo(() => {
    if (!lastRepliedFeedback)
      return {
        imageUri: null,
        content: null,
        comment: null,
      };

    return {
      imageUri: lastRepliedFeedback.image_url_list?.[0] || null,
      content: lastRepliedFeedback.content || null,
      comment: lastRepliedFeedback.comment || null,
      // comment: !__DEV__
      //   ? lastRepliedFeedback.comment || null
      //   : 'Known issue: ' + '100000'.repeat(50),
    };
  }, [lastRepliedFeedback]);

  if (lastRepliedFeedback?.status !== 'complete') return null;

  const stagesList = (() => {
    return [
      {
        title: t('component.feedbackModal.issueDescription'),
        contentNode: imageUri && (
          <View style={styles.contentWrapper}>
            {content && (
              <View style={styles.feedbackDesc}>
                <Text style={styles.descText}>
                  <Text>
                    {t('component.feedbackModal.issueDescriptionLabel')}
                    {content}
                  </Text>
                </Text>
              </View>
            )}
            <Image
              source={{ uri: imageUri }}
              style={styles.feedbackImage}
              resizeMode="cover"
            />
          </View>
        ),
      },
      comment
        ? {
            title: t('component.feedbackModal.repliedTitle'),
            finished: true,
            contentNode: (
              <View style={styles.contentWrapper}>
                <Text style={styles.descText}>{comment}</Text>
              </View>
            ),
          }
        : {
            title: t('component.feedbackModal.pendingTitle'),
            contentNode: null,
          },
    ].filter(Boolean) as {
      title: string | React.ReactNode;
      contentNode: React.ReactNode;
      finished?: boolean;
    }[];
  })();

  return (
    <AppBottomSheetModal
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      ref={sheetModalRef}
      index={0}
      snapPoints={[514]}
      enableDismissOnClose
      onDismiss={() => {
        finishViewFeedback();
      }}
      enableContentPanningGesture={true}
      enablePanDownToClose={true}
      containerStyle={styles.sheetModal}
      footerComponent={() => {
        return (
          <FooterComponent
            style={styles.sheetModalFooter}
            onPress={() => finishViewFeedback()}
          />
        );
      }}>
      <View style={styles.mainContainer}>
        <AutoLockView style={[styles.container]}>
          <BottomSheetHandlableView style={styles.titleContainer}>
            <Text style={styles.title}>
              {t('component.feedbackModal.title')}
            </Text>
          </BottomSheetHandlableView>

          <BottomSheetScrollView style={styles.stagesContainer}>
            {stagesList.map((stage, index) => {
              const key = `stage-${index}-${stage.title}`;
              const isLast = index === stagesList.length - 1;
              return (
                <View
                  key={key}
                  style={[styles.stage, isLast && styles.lastStage]}>
                  {!stage.finished ? (
                    <View style={[styles.stagePointContainer]} />
                  ) : (
                    <View style={[styles.stagePointContainer]}>
                      <RcSuccessCC
                        style={styles.stagePointIcon}
                        color={colors2024['neutral-InvertHighlight']}
                      />
                    </View>
                  )}
                  <Text style={styles.stageTitle}>{stage.title}</Text>
                  <View style={styles.stageContent}>{stage.contentNode}</View>
                </View>
              );
            })}
          </BottomSheetScrollView>
        </AutoLockView>
      </View>
    </AppBottomSheetModal>
  );
}

export function FeedbackEntryOnHeader({ style }: RNViewProps) {
  const { lastRepliedFeedback } = useLatestRepliedFeedbacks();

  const { styles } = useTheme2024({ getStyle });

  const { startViewingFeedback } = useViewingFeedback();

  if (lastRepliedFeedback?.status !== 'complete') return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.iconContainer, style]}
        onPress={() => {
          startViewingFeedback(lastRepliedFeedback);

          matomoRequestEvent({
            category: 'Click_Header',
            action: 'Click_Setting',
          });
        }}>
        <RcEntryCC style={styles.icon} color={styles.icon.color} />
      </TouchableOpacity>

      <ModalResponseDetail lastRepliedFeedback={lastRepliedFeedback} />
    </>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  iconContainer: {
    height: '100%',
  },
  icon: {
    width: 20,
    height: 20,
    color: colors2024['neutral-foot'],
  },

  sheetModal: {
    position: 'relative',
  },
  sheetModalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    paddingBottom: 24,
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

const FOOTER_SIZES = {
  height: 56,
  marginBottom: 8,
  extraSpace: 12,
  get totalHeight() {
    return this.height + this.marginBottom + this.extraSpace;
  },
};
function FooterComponent({
  onPress,
  style,
}: RNViewProps & { onPress?(): void }) {
  const { styles } = useTheme2024({ getStyle: getFooterComponentStyle });
  const { safeSizes } = useSafeAndroidBottomSizes({
    footerHeight: FOOTER_SIZES.totalHeight,
  });
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.footerContainer,
        { height: safeSizes.footerHeight },
        style,
      ]}>
      <Button
        title={t('global.ok')}
        containerStyle={styles.okButtonContainer}
        buttonStyle={styles.okButton}
        titleStyle={styles.okButtonTitle}
        type="primary"
        onPress={onPress}
      />
    </View>
  );
}

const getFooterComponentStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    footerContainer: {
      width: '100%',
      paddingHorizontal: 20,
    },
    okButtonContainer: {
      height: FOOTER_SIZES.height,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    okButton: {
      height: FOOTER_SIZES.height,
    },
    okButtonTitle: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors2024['neutral-InvertHighlight'],
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 24,
    },
  };
});
