import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { toast } from '@/components2024/Toast';
import { INITIAL_OPENAPI_URL } from '@/constant';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

export const OpenApiPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
}> = ({ visible, onClose }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const [host, setHost] = useState(openapi.getHost());

  const handleConfirm = useMemoizedFn(() => {
    const v = host.trim();
    if (/^https?:\/\//.test(v)) {
      openapi.setHost(v);
      toast.success('Success');
      onClose?.();
    } else {
      toast.error('Please input invalid url');
    }
  });

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setHost(openapi.getHost);
    }
  }, [visible]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  return (
    <AppBottomSheetModal
      onDismiss={onClose}
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView style={styles.popup}>
        <AutoLockView>
          <View style={styles.header}>
            <Text style={styles.title}>Backend Service URL</Text>
          </View>
          <View style={styles.body}>
            <BottomSheetTextInput
              style={styles.textInput}
              value={host}
              onChangeText={setHost}
            />
            {host !== INITIAL_OPENAPI_URL ? (
              <View style={styles.extra}>
                <TouchableOpacity
                  onPress={() => {
                    setHost(INITIAL_OPENAPI_URL);
                  }}>
                  <Text style={styles.extraText}>Restore initial setting</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          <FooterButtonGroup
            style={styles.footer}
            onCancel={onClose}
            onConfirm={handleConfirm}
          />
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  popup: {
    margin: 0,
    height: '100%',
    minHeight: 364,
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    paddingBottom: 0,
  },
  body: {
    paddingHorizontal: 24,
    height: 120,
  },
  extra: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },

  extraText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['brand-default'],
  },

  textInput: {
    height: 52,
    borderRadius: 6,
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    fontSize: 16,
    textAlign: undefined,
    lineHeight: undefined,
    backgroundColor: colors2024['neutral-bg-gray'],
    paddingHorizontal: 16,
  },

  footer: {
    paddingTop: 24,
    paddingBottom: 56,
    paddingHorizontal: 24,
  },
}));
