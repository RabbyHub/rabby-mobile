import { useLayoutEffect, useRef } from 'react';
import type { View } from 'react-native';

export type PerpsProSheetBackTarget = {
  ref: React.RefObject<View | null>;
  sessionKey: string;
};

export type PerpsProSheetNavigationRegistration = {
  backTargetRef: React.MutableRefObject<PerpsProSheetBackTarget | null>;
  dismissibleRef: React.MutableRefObject<boolean>;
  dismissRef: React.MutableRefObject<() => void>;
  edgeDismissibleRef: React.MutableRefObject<boolean>;
  id: symbol;
};

const registrations: PerpsProSheetNavigationRegistration[] = [];
const listeners = new Set<() => void>();
let registryVersion = 0;

const publish = () => {
  registryVersion += 1;
  listeners.forEach(listener => listener());
};

export const subscribePerpsProSheetNavigation = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPerpsProSheetNavigationVersion = () => registryVersion;

export const getTopPerpsProSheetNavigationRegistration = () =>
  registrations.at(-1) ?? null;

const removeRegistration = (id: symbol) => {
  const index = registrations.findIndex(item => item.id === id);
  if (index < 0) return;
  registrations.splice(index, 1);
  publish();
};

export const requestDismissPerpsProSheet = (
  registration: PerpsProSheetNavigationRegistration,
  source: 'back' | 'edge' = 'back',
) => {
  if (
    getTopPerpsProSheetNavigationRegistration()?.id !== registration.id ||
    !registration.dismissibleRef.current ||
    (source === 'edge' && !registration.edgeDismissibleRef.current)
  ) {
    return;
  }
  registration.dismissRef.current();
};

type WindowPoint = { absoluteX: number; absoluteY: number };

/** Forward only the part of an actual back button covered by the iOS edge layer. */
export const beginPerpsProSheetBackTap = (
  registration: PerpsProSheetNavigationRegistration | null,
  start: WindowPoint,
) => {
  const target = registration?.backTargetRef.current;
  const node = target?.ref.current;
  const version = registryVersion;
  let cancelled = false;
  let finished = false;
  if (!registration || !target || !node) {
    return null;
  }
  const isCurrent = () =>
    !cancelled &&
    version === registryVersion &&
    getTopPerpsProSheetNavigationRegistration() === registration &&
    registration.dismissibleRef.current &&
    registration.edgeDismissibleRef.current &&
    registration.backTargetRef.current === target &&
    target.ref.current === node;
  if (!isCurrent()) {
    return null;
  }
  return {
    cancel: () => {
      cancelled = true;
    },
    finish: (end: WindowPoint) => {
      if (finished || !isCurrent()) {
        return;
      }
      finished = true;
      node.measureInWindow((x, y, width, height) => {
        if (!isCurrent()) {
          return;
        }
        cancelled = true;
        const contains = (point: WindowPoint) =>
          point.absoluteX >= x &&
          point.absoluteX <= x + width &&
          point.absoluteY >= y &&
          point.absoluteY <= y + height;
        if (
          [x, y, width, height].every(Number.isFinite) &&
          width > 0 &&
          height > 0 &&
          contains(start) &&
          contains(end)
        ) {
          requestDismissPerpsProSheet(registration);
        }
      });
    },
  };
};

export const usePerpsProSheetNavigationRegistration = ({
  active,
  backTarget = null,
  dismiss,
  dismissible = true,
  edgeDismissible = dismissible,
}: {
  active: boolean;
  backTarget?: PerpsProSheetBackTarget | null;
  dismiss: () => void;
  dismissible?: boolean;
  edgeDismissible?: boolean;
}) => {
  const registrationRef = useRef<PerpsProSheetNavigationRegistration | null>(
    null,
  );
  if (!registrationRef.current) {
    registrationRef.current = {
      backTargetRef: { current: backTarget },
      dismissibleRef: { current: dismissible },
      dismissRef: { current: dismiss },
      edgeDismissibleRef: { current: edgeDismissible },
      id: Symbol('perps-pro-sheet'),
    };
  }
  const registration = registrationRef.current;
  registration.backTargetRef.current = backTarget;
  registration.dismissRef.current = dismiss;
  registration.dismissibleRef.current = dismissible;
  registration.edgeDismissibleRef.current = edgeDismissible;

  useLayoutEffect(() => {
    if (!active) return;
    removeRegistration(registration.id);
    registrations.push(registration);
    publish();
    return () => removeRegistration(registration.id);
  }, [active, registration]);

  return registration;
};

export const resetPerpsProSheetNavigationGuardForTests = () => {
  registrations.splice(0, registrations.length);
  publish();
};
