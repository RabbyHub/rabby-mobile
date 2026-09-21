import { useCallback, useState } from 'react';

export type PerpsProPositionSizeUnit = 'base' | 'quote';

const positionSizeUnits = new Map<string, PerpsProPositionSizeUnit>();

const buildSessionKey = (accountIdentity: string, positionKey: string) =>
  `${accountIdentity}\u0000${positionKey}`;

export const getPerpsProPositionSizeUnit = (
  accountIdentity: string,
  positionKey: string,
): PerpsProPositionSizeUnit =>
  positionSizeUnits.get(buildSessionKey(accountIdentity, positionKey)) ??
  'quote';

export const setPerpsProPositionSizeUnit = (
  accountIdentity: string,
  positionKey: string,
  unit: PerpsProPositionSizeUnit,
) => {
  positionSizeUnits.set(buildSessionKey(accountIdentity, positionKey), unit);
};

export const usePerpsProPositionSizeUnit = (
  accountIdentity: string,
  positionKey: string,
) => {
  const [unit, setUnitState] = useState<PerpsProPositionSizeUnit>(() =>
    getPerpsProPositionSizeUnit(accountIdentity, positionKey),
  );
  const toggle = useCallback(() => {
    setUnitState(current => {
      const next = current === 'quote' ? 'base' : 'quote';
      setPerpsProPositionSizeUnit(accountIdentity, positionKey, next);
      return next;
    });
  }, [accountIdentity, positionKey]);

  return { toggle, unit };
};

export const __resetPerpsProPositionSizeUnitSessionForTests = () => {
  positionSizeUnits.clear();
};
