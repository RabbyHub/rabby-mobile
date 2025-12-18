import React, { useCallback } from 'react';

import { noop } from 'lodash';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { Button } from '@/components2024/Button';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';

import { useMode } from '../hooks/useMode';
import { PairTable } from '../components/overviews/ManageEmodeOverView';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { CategorySelector } from '../components/EmodeCategory/CategorySelector';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import { formatPercent } from '@/screens/TokenDetail/util';

const DisableEmodeOverviewModal = ({ onClose }: { onClose: () => void }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { emodeCategoryId, eModes, currentEmode } = useMode();

  const handleMaxLTVDescription = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: '',
      titleStyle: {
        marginTop: 0,
        fontWeight: '900',
      },
      sectionStyle: {
        marginTop: 8,
      },
      sectionDescStyle: {
        lineHeight: 20,
      },
      sections: [
        {
          description: t('page.Lending.modalDesc.maxLTV'),
        },
      ],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [308],
      },
      allowAndroidHarewareBack: true,
      nextButtonProps: {
        title: t('page.Lending.gotIt'),
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        containerStyle: {
          position: 'absolute',
          bottom: 48,
          width: '100%',
        },
      },
    });
  };

  const handlePressManageEMode = useCallback(async () => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.MANAGE_EMODE_FULL,
      allowAndroidHarewareBack: true,
      bottomSheetModalProps: {
        rootViewType: 'View',
        enableContentPanningGesture: true,
        snapPoints: [550],
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
    onClose?.();
  }, [onClose]);

  return (
    <AutoLockView as="View" style={styles.container}>
      <BottomSheetScrollView
        showsHorizontalScrollIndicator
        style={styles.scrollableBlock}
        contentContainerStyle={[styles.contentContainer]}>
        <Text style={styles.headerTitle}>
          {t('page.Lending.manageEmode.guide.title')}
        </Text>
        <Text style={styles.description}>
          {t('page.Lending.manageEmode.guide.description')}
        </Text>
        <View style={styles.categoryContainer}>
          <CategorySelector
            label={emodeCategoryId ? eModes[emodeCategoryId]?.label : ''}
            onChange={noop}
            style={styles.categorySelector}
            value={emodeCategoryId}
            disable
          />
          <View style={[styles.item]}>
            <View style={styles.maxLtvContainer}>
              <Text style={styles.title}>{t('page.Lending.maxLtv')}</Text>
              <Pressable hitSlop={20} onPress={handleMaxLTVDescription}>
                <WarningFillCC
                  width={12}
                  height={12}
                  color={colors2024['neutral-info']}
                />
              </Pressable>
            </View>
            <Text style={styles.ltv}>
              {formatPercent(Number(currentEmode?.ltv || '0') / 10000)}
            </Text>
          </View>
          <PairTable
            data={currentEmode ? currentEmode?.assets || [] : []}
            style={styles.table}
          />
        </View>
      </BottomSheetScrollView>
      <View style={[styles.buttonContainer]}>
        <Button
          loadingType="circle"
          showTextOnLoading
          containerStyle={styles.fullWidthButton}
          onPress={() => handlePressManageEMode()}
          title={t('page.Lending.manageEmode.disableTitle')}
          titleStyle={styles.closeButtonTitle}
          buttonStyle={styles.closeButton}
        />
      </View>
    </AutoLockView>
  );
};

export default DisableEmodeOverviewModal;

const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingBottom: 0,
    height: '100%',
    position: 'relative',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  scrollableBlock: {
    flex: 1,
    height: '100%',
  },
  contentContainer: {
    paddingHorizontal: 25,
    paddingBottom: 120,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  title: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 25,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    position: 'absolute',
    bottom: 56,
    width: '100%',
  },
  disabledButton: {
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  disabledTitle: {
    color: ctx.colors2024['neutral-title-1'],
  },
  gasPreContainer: {
    paddingHorizontal: 8,
    marginTop: 12,
    width: '100%',
  },
  buttonContainer: {
    position: 'absolute',
    paddingHorizontal: 25,
    bottom: 0,
    height: 116,
    paddingTop: 12,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  directSignBtn: {
    width: '100%',
  },
  fullWidthButton: {
    flex: 1,
  },
  closeButtonTitle: {
    color: ctx.colors2024['neutral-title-1'],
  },
  closeButton: {
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  item: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  table: {
    marginTop: 2,
  },
  maxLtvContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ltv: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  categoryContainer: {
    borderWidth: 1,
    borderColor: ctx.colors2024['neutral-line'],
    gap: 24,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  categorySelector: {
    width: '100%',
  },
}));
