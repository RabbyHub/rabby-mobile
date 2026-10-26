import React, {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from 'react';
import type { ViewProps } from 'react-native';

import {
  TokenSelectorSheetModal,
  type TokenSelectorProps,
  type TokenSelectorSheetModalInst,
} from './TokenSelectorSheetModal';
import { DeferredSheetModalCommandQueue } from './deferredSheetModalCommands';

type DeferredTokenSelectorSheetModalProps = ViewProps &
  TokenSelectorProps & {
    ref?: Ref<TokenSelectorSheetModalInst>;
  };

export const DeferredTokenSelectorSheetModal = ({
  ref,
  ...props
}: DeferredTokenSelectorSheetModalProps) => {
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<TokenSelectorSheetModalInst>(null);
  const commandQueueRef = useRef(new DeferredSheetModalCommandQueue());

  useImperativeHandle(
    ref,
    () => ({
      toggleShow: command => {
        if (commandQueueRef.current.handle(command, modalRef.current)) {
          setMounted(true);
        }
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    if (!mounted || !modalRef.current) {
      return;
    }

    commandQueueRef.current.flush(modalRef.current);
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return <TokenSelectorSheetModal {...props} ref={modalRef} />;
};
