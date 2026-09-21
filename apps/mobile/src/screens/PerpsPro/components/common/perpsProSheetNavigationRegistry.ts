import { useLayoutEffect, useRef } from 'react';

export type PerpsProSheetNavigationRegistration = {
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

export const usePerpsProSheetNavigationRegistration = ({
  active,
  dismiss,
  dismissible = true,
  edgeDismissible = dismissible,
}: {
  active: boolean;
  dismiss: () => void;
  dismissible?: boolean;
  edgeDismissible?: boolean;
}) => {
  const registrationRef = useRef<PerpsProSheetNavigationRegistration | null>(
    null,
  );
  if (!registrationRef.current) {
    registrationRef.current = {
      dismissibleRef: { current: dismissible },
      dismissRef: { current: dismiss },
      edgeDismissibleRef: { current: edgeDismissible },
      id: Symbol('perps-pro-sheet'),
    };
  }
  const registration = registrationRef.current;
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
