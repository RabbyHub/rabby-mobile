import { useEffect } from 'react';
import { create } from 'zustand';

import {
  DEFAULT_SIMPLE_CHART_PREFERENCE,
  normalizeSimpleChartPreference,
  type SimpleChartPreference,
} from '@/constant/perpsSimpleChart';
import { apisPerps } from '@/core/apis/perps';

type PerpsChartPreferenceState = {
  hydrated: boolean;
  preference: SimpleChartPreference;
};

/**
 * One in-memory owner for the persisted chart preference, so Simple and Pro
 * stay linked even while both screens are mounted.
 */
const usePerpsChartPreferenceStore = create<PerpsChartPreferenceState>(() => ({
  hydrated: false,
  preference: DEFAULT_SIMPLE_CHART_PREFERENCE,
}));

let editGeneration = 0;
let writes: Promise<void> = Promise.resolve();

function hydratePerpsChartPreference() {
  const generation = editGeneration;
  // Read after queued writes so a slow write cannot be overwritten by its
  // own stale value.
  writes
    .then(() => apisPerps.getSimpleChartPreference())
    .then(value => {
      if (generation === editGeneration) {
        usePerpsChartPreferenceStore.setState({
          preference: normalizeSimpleChartPreference(value),
        });
      }
    })
    .catch(error => console.error('[PerpsChart] read preference', error))
    .finally(() => usePerpsChartPreferenceStore.setState({ hydrated: true }));
}

export function updatePerpsChartPreference(value: SimpleChartPreference) {
  const next = normalizeSimpleChartPreference(value);
  editGeneration += 1;
  usePerpsChartPreferenceStore.setState({ preference: next });
  writes = writes
    .then(() => apisPerps.setSimpleChartPreference(next))
    .catch(error => console.error('[PerpsChart] save preference', error));
}

export function usePerpsChartPreference() {
  useEffect(hydratePerpsChartPreference, []);
  const preference = usePerpsChartPreferenceStore(state => state.preference);
  const hydrated = usePerpsChartPreferenceStore(state => state.hydrated);
  return { hydrated, preference };
}
