import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Dimensions,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import useAsync from 'react-use/lib/useAsync';

import { useLatestLocalFeedback, useViewingLastFeedback } from './hooks';

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
import { openapi } from '@/core/request';
import { Button } from '@/components2024/Button';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

export function FeedbackEntryOnHeader({ style }: RNViewProps) {
  const localFeedback = useLatestLocalFeedback();

  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const { viewingLastFeedback, setViewingLastFeedback } =
    useViewingLastFeedback();

  const feedbackId = localFeedback?.id;
  useEffect(() => {
    if (viewingLastFeedback) {
      toggleShowSheetModal(true);
    } else {
      toggleShowSheetModal('destroy');
    }
  }, [viewingLastFeedback, toggleShowSheetModal]);

  const {
    value: lastFeedback,
    loading,
    error,
  } = useAsync(async () => {
    if (!feedbackId) return;

    const feedback = await openapi.getUserFeedback(feedbackId);
    return feedback;
  }, [feedbackId]);

  const { imageUri, content, comment } = useMemo(() => {
    if (!lastFeedback)
      return {
        imageUri: null,
        content: null,
        comment: null,
      };

    return {
      imageUri: lastFeedback.image_url_list?.[0] || null,
      content: lastFeedback.content || null,
      comment: lastFeedback.comment || null,
      // comment: !__DEV__
      //   ? lastFeedback.comment || null
      //   : 'Known issue: ' + '100000'.repeat(50),
    };
  }, [lastFeedback]);

  if (!localFeedback || !lastFeedback) return null;

  const stagesList = (() => {
    return [
      {
        title: t('component.feedbackModal.issueDescription'),
        contentNode: imageUri && (
          <View style={styles.contentWrapper}>
            <View style={styles.feedbackDesc}>
              <Text style={styles.descText}>
                <Text>
                  {t('component.feedbackModal.issueDescriptionLabel')}
                  {content}
                </Text>
              </Text>
            </View>
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
    <>
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.iconContainer, style]}
        onPress={() => {
          setViewingLastFeedback(true);

          matomoRequestEvent({
            category: 'Click_Header',
            action: 'Click_Setting',
          });
        }}>
        <RcEntryCC style={styles.icon} color={styles.icon.color} />
      </TouchableOpacity>

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
          setViewingLastFeedback(false);
        }}
        // enableDynamicSizing
        // maxDynamicContentSize={maxHeight}
        enableContentPanningGesture={true}
        enablePanDownToClose={false}
        containerStyle={styles.sheetModal}
        footerComponent={() => {
          return (
            <FooterComponent
              style={styles.sheetModalFooter}
              onPress={() => setViewingLastFeedback(false)}
            />
          );
        }}>
        <BottomSheetScrollView style={styles.scrollableView}>
          <AutoLockView style={[styles.container]}>
            <View style={[styles.panelContainer]}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>
                  {t('component.feedbackModal.title')}
                </Text>
              </View>

              <View style={styles.stagesContainer}>
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
                      <View style={styles.stageContent}>
                        {stage.contentNode}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </AutoLockView>
        </BottomSheetScrollView>
      </AppBottomSheetModal>
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
  scrollableView: {
    paddingBottom: 24,
    maxHeight: 380,
  },
  container: {
    flex: 1,
  },
  panelContainer: {
    alignItems: 'center',
    width: '100%',
  },
  titleContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: 800,
    lineHeight: 24,
  },
  stagesContainer: {
    flexDirection: 'column',
    position: 'relative',
    width: '100%',
    paddingHorizontal: 32,
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
