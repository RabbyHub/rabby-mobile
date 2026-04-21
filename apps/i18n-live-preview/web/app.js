const state = {
  currentPage: 1,
  detail: null,
  devices: [],
  editorValue: '',
  pageSize: 100,
  searchQuery: '',
  selectedDeviceId: '',
  selectedKey: '',
  selectedLocale: '',
};

const elements = {
  clearPatchButton: document.getElementById('clearPatchButton'),
  deviceCountValue: document.getElementById('deviceCountValue'),
  deviceHint: document.getElementById('deviceHint'),
  deviceList: document.getElementById('deviceList'),
  editorBaseValue: document.getElementById('editorBaseValue'),
  editorEmpty: document.getElementById('editorEmpty'),
  editorKey: document.getElementById('editorKey'),
  editorPanel: document.getElementById('editorPanel'),
  editorPatchedValue: document.getElementById('editorPatchedValue'),
  exportJsonButton: document.getElementById('exportJsonButton'),
  localeSelect: document.getElementById('localeSelect'),
  nextPageButton: document.getElementById('nextPageButton'),
  pageInfo: document.getElementById('pageInfo'),
  pageSizeSelect: document.getElementById('pageSizeSelect'),
  prevPageButton: document.getElementById('prevPageButton'),
  reloadDevicesButton: document.getElementById('reloadDevicesButton'),
  resultCount: document.getElementById('resultCount'),
  savePatchButton: document.getElementById('savePatchButton'),
  searchInput: document.getElementById('searchInput'),
  searchResults: document.getElementById('searchResults'),
  selectedDeviceValue: document.getElementById('selectedDeviceValue'),
  selectedLocaleValue: document.getElementById('selectedLocaleValue'),
  statusMessage: document.getElementById('statusMessage'),
};

function setStatus(message, tone = 'neutral') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status ${tone}`;
}

function flattenJson(source, prefix = '') {
  const rows = [];

  Object.entries(source || {}).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      rows.push(...flattenJson(value, nextKey));
      return;
    }

    rows.push({
      key: nextKey,
      value: value == null ? '' : String(value),
    });
  });

  return rows;
}

function getLocaleData(locale) {
  const detail = state.detail;
  if (!detail) {
    return {
      baseEntries: [],
      mergedEntries: [],
      patchMap: {},
    };
  }

  const baseRows = flattenJson(detail.snapshotByLocale?.[locale] || {});
  const mergedRows = flattenJson(detail.mergedByLocale?.[locale] || {});
  const patchMap = detail.patchesByLocale?.[locale] || {};

  return {
    baseEntries: baseRows,
    mergedEntries: mergedRows,
    patchMap,
  };
}

function getMergedRows() {
  const locale = state.selectedLocale;
  const { baseEntries, mergedEntries, patchMap } = getLocaleData(locale);
  const baseMap = new Map(baseEntries.map(entry => [entry.key, entry.value]));

  return mergedEntries
    .map(entry => ({
      baseValue: baseMap.get(entry.key) || '',
      isPatched: Boolean(patchMap[entry.key]),
      key: entry.key,
      value: entry.value,
    }))
    .sort((left, right) => {
      if (left.isPatched !== right.isPatched) {
        return left.isPatched ? -1 : 1;
      }
      return left.key.localeCompare(right.key);
    });
}

function getVisibleRows() {
  const rows = getMergedRows();
  const query = state.searchQuery.trim().toLowerCase();

  if (!query) {
    return rows;
  }

  return rows
    .map(row => {
      const rank = getSearchRank(row, query);
      return rank ? { ...row, _searchRank: rank } : null;
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left._searchRank.score !== right._searchRank.score) {
        return left._searchRank.score - right._searchRank.score;
      }

      if (left._searchRank.distance !== right._searchRank.distance) {
        return left._searchRank.distance - right._searchRank.distance;
      }

      if (left.isPatched !== right.isPatched) {
        return left.isPatched ? -1 : 1;
      }

      return left.key.localeCompare(right.key);
    })
    .map(row => {
      delete row._searchRank;
      return row;
    });
}

function tokenizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff_-]+/i)
    .filter(Boolean);
}

function buildSearchCandidates(row) {
  const candidates = new Set();
  const pushTokens = value => {
    tokenizeSearchText(value).forEach(token => {
      candidates.add(token);
    });
  };

  [row.key, row.value, row.baseValue].filter(Boolean).forEach(value => {
    const normalized = String(value).toLowerCase();
    candidates.add(normalized);
    pushTokens(normalized);
  });

  return Array.from(candidates).filter(Boolean).slice(0, 40);
}

function getSearchRank(row, query) {
  const candidates = buildSearchCandidates(row);
  let best = null;

  candidates.forEach(candidate => {
    const includeIndex = candidate.indexOf(query);
    if (includeIndex === -1) {
      return;
    }

    const exact = candidate === query;
    const prefix = !exact && includeIndex === 0;
    const tokenized = tokenizeSearchText(candidate);
    const tokenExact = tokenized.includes(query);
    const tokenPrefix = !tokenExact && tokenized.some(token => token.startsWith(query));

    const score = exact
      ? 0
      : tokenExact
        ? 10
        : prefix
          ? 20
          : tokenPrefix
            ? 30
            : 40 + includeIndex;

    const rank = {
      distance: includeIndex,
      score,
    };

    if (
      !best ||
        rank.score < best.score ||
        (rank.score === best.score && rank.distance < best.distance)
    ) {
      best = rank;
    }
  });

  return best;
}

function getCurrentEditorSourceValue() {
  if (!state.selectedKey || !state.selectedLocale) {
    return '';
  }

  const { baseEntries, patchMap } = getLocaleData(state.selectedLocale);
  const baseMap = new Map(baseEntries.map(entry => [entry.key, entry.value]));

  if (patchMap[state.selectedKey]) {
    return patchMap[state.selectedKey].value;
  }

  return baseMap.get(state.selectedKey) || '';
}

function hasUnsavedEditorChanges() {
  if (!state.selectedKey) {
    return false;
  }

  return elements.editorPatchedValue.value !== getCurrentEditorSourceValue();
}

function getPagedRows(rows) {
  const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  const currentPage = Math.min(state.currentPage, totalPages);
  const start = (currentPage - 1) * state.pageSize;

  state.currentPage = currentPage;

  return {
    currentPage,
    rows: rows.slice(start, start + state.pageSize),
    totalPages,
  };
}

function renderDeviceList() {
  elements.deviceCountValue.textContent = String(state.devices.length);
  elements.deviceList.innerHTML = '';

  if (!state.devices.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No devices have registered yet.';
    elements.deviceList.appendChild(empty);
    return;
  }

  state.devices.forEach(device => {
    const button = document.createElement('button');
    button.className = `device-card ${device.deviceId === state.selectedDeviceId ? 'active' : ''}`;
    button.type = 'button';
    button.innerHTML = `
      <div class="device-card-top">
        <strong>${escapeHtml(device.deviceName)}</strong>
        <span class="badge ${device.isOnline ? 'online' : 'offline'}">
          ${device.isOnline ? 'online' : 'offline'}
        </span>
      </div>
      <div class="device-card-meta">${escapeHtml(device.deviceId)}</div>
      <div class="device-card-meta">${escapeHtml(device.currentLocale || 'no locale')}</div>
      <div class="device-card-meta">${device.patchCount} patches</div>
    `;
    button.addEventListener('click', () => {
      loadDeviceDetail(device.deviceId, {
        preserveSelection: false,
        silent: false,
      }).catch(error => {
        setStatus(`Failed to load device: ${error.message}`, 'error');
      });
    });
    elements.deviceList.appendChild(button);
  });
}

function renderLocaleOptions() {
  const locales = state.detail?.availableLocales || [];
  elements.localeSelect.innerHTML = '';

  if (!locales.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No locale';
    elements.localeSelect.appendChild(option);
    return;
  }

  locales.forEach(locale => {
    const option = document.createElement('option');
    option.value = locale;
    option.textContent = locale;
    option.selected = locale === state.selectedLocale;
    elements.localeSelect.appendChild(option);
  });
}

function renderResults() {
  const allRows = getVisibleRows();
  const paged = getPagedRows(allRows);
  const rows = paged.rows;
  elements.searchResults.innerHTML = '';
  elements.resultCount.textContent = `${allRows.length} results`;
  elements.pageInfo.textContent = `Page ${paged.currentPage} / ${paged.totalPages}`;
  elements.prevPageButton.disabled = paged.currentPage <= 1;
  elements.nextPageButton.disabled = paged.currentPage >= paged.totalPages;

  if (!state.detail) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Select a device first.';
    elements.searchResults.appendChild(empty);
    return;
  }

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No matching key or value.';
    elements.searchResults.appendChild(empty);
    return;
  }

  rows.forEach(row => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `result-row ${row.key === state.selectedKey ? 'active' : ''}`;
    button.innerHTML = `
      <div class="result-row-top">
        <strong>${escapeHtml(row.key)}</strong>
        ${row.isPatched ? '<span class="badge patched">patched</span>' : ''}
      </div>
      <div class="result-row-value">${escapeHtml(row.value || '(empty)')}</div>
    `;
    button.addEventListener('click', () => {
      state.selectedKey = row.key;
      state.editorValue = row.value;
      renderEditor();
      renderResults();
    });
    elements.searchResults.appendChild(button);
  });
}

function renderEditor() {
  const locale = state.selectedLocale;
  const { baseEntries, patchMap } = getLocaleData(locale);
  const baseMap = new Map(baseEntries.map(entry => [entry.key, entry.value]));

  elements.selectedDeviceValue.textContent = state.selectedDeviceId || 'None';
  elements.selectedLocaleValue.textContent = state.selectedLocale || '-';

  if (!state.selectedKey) {
    elements.editorEmpty.classList.remove('hidden');
    elements.editorPanel.classList.add('hidden');
    return;
  }

  elements.editorEmpty.classList.add('hidden');
  elements.editorPanel.classList.remove('hidden');
  elements.editorKey.value = state.selectedKey;
  elements.editorBaseValue.value = baseMap.get(state.selectedKey) || '';

  if (patchMap[state.selectedKey]) {
    elements.editorPatchedValue.value = patchMap[state.selectedKey].value;
  } else {
    elements.editorPatchedValue.value = state.editorValue;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchDevices() {
  const payload = await fetchJson('/api/v1/devices');
  state.devices = payload.devices || [];
  renderDeviceList();
}

async function loadDeviceDetail(deviceId, options = {}) {
  const { preserveSelection = false, silent = false } = options;
  const payload = await fetchJson(`/api/v1/devices/${encodeURIComponent(deviceId)}`);
  const previousSelectedLocale = preserveSelection ? state.selectedLocale : '';
  const previousSelectedKey = preserveSelection ? state.selectedKey : '';
  const previousEditorValue = preserveSelection ? elements.editorPatchedValue.value : '';
  const previousCurrentPage = preserveSelection ? state.currentPage : 1;
  state.detail = payload;
  state.selectedDeviceId = deviceId;
  state.selectedLocale =
    (preserveSelection && payload.availableLocales.includes(previousSelectedLocale)
      ? previousSelectedLocale
      : '') ||
    payload.device.currentLocale ||
    payload.availableLocales[0] ||
    '';
  state.currentPage = preserveSelection ? previousCurrentPage : 1;
  state.selectedKey = preserveSelection ? previousSelectedKey : '';
  state.editorValue = preserveSelection ? previousEditorValue : '';
  renderDeviceList();
  renderLocaleOptions();
  renderResults();
  renderEditor();
  elements.deviceHint.textContent = `Browsing uploaded snapshot from ${payload.device.deviceName}.`;
  if (!silent) {
    setStatus('Loaded device snapshot.', 'success');
  }
}

async function savePatch() {
  if (!state.selectedDeviceId || !state.selectedLocale || !state.selectedKey) {
    setStatus('Select a device, locale, and key first.', 'error');
    return;
  }

  const value = elements.editorPatchedValue.value;
  const payload = await fetchJson(
    `/api/v1/devices/${encodeURIComponent(state.selectedDeviceId)}/patches`,
    {
      body: JSON.stringify({
        key: state.selectedKey,
        locale: state.selectedLocale,
        value,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  state.detail = payload;
  state.editorValue = value;
  renderLocaleOptions();
  renderResults();
  renderEditor();
  setStatus('Patch saved. The target device will receive it on the next poll.', 'success');
}

async function clearPatch() {
  if (!state.selectedDeviceId || !state.selectedLocale || !state.selectedKey) {
    setStatus('Select a patched key first.', 'error');
    return;
  }

  const payload = await fetchJson(
    `/api/v1/devices/${encodeURIComponent(state.selectedDeviceId)}/patches?locale=${encodeURIComponent(state.selectedLocale)}&key=${encodeURIComponent(state.selectedKey)}`,
    {
      method: 'DELETE',
    },
  );

  state.detail = payload;
  renderLocaleOptions();
  renderResults();
  renderEditor();
  setStatus('Patch cleared.', 'success');
}

async function exportLocaleJson() {
  if (!state.selectedDeviceId || !state.selectedLocale) {
    setStatus('Select a device and locale first.', 'error');
    return;
  }

  const response = await fetch(
    `/api/v1/devices/${encodeURIComponent(state.selectedDeviceId)}/export?locale=${encodeURIComponent(state.selectedLocale)}`,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${state.selectedDeviceId}-${state.selectedLocale}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus('Exported merged JSON.', 'success');
}

function scheduleAutoRefresh() {
  setInterval(() => {
    fetchDevices().catch(() => undefined);
    if (state.selectedDeviceId && !hasUnsavedEditorChanges()) {
      loadDeviceDetail(state.selectedDeviceId, {
        preserveSelection: true,
        silent: true,
      }).catch(() => undefined);
    }
  }, 5000);
}

elements.reloadDevicesButton.addEventListener('click', () => {
  fetchDevices()
    .then(() => setStatus('Device list reloaded.', 'success'))
    .catch(error => {
      setStatus(`Reload failed: ${error.message}`, 'error');
    });
});

elements.localeSelect.addEventListener('change', () => {
  state.selectedLocale = elements.localeSelect.value;
  state.currentPage = 1;
  state.selectedKey = '';
  renderResults();
  renderEditor();
});

elements.searchInput.addEventListener('input', () => {
  state.searchQuery = elements.searchInput.value;
  state.currentPage = 1;
  renderResults();
});

elements.pageSizeSelect.addEventListener('change', () => {
  state.pageSize = Number(elements.pageSizeSelect.value) || 100;
  state.currentPage = 1;
  renderResults();
});

elements.prevPageButton.addEventListener('click', () => {
  state.currentPage = Math.max(1, state.currentPage - 1);
  renderResults();
});

elements.nextPageButton.addEventListener('click', () => {
  state.currentPage += 1;
  renderResults();
});

elements.editorPatchedValue.addEventListener('input', () => {
  state.editorValue = elements.editorPatchedValue.value;
});

elements.savePatchButton.addEventListener('click', () => {
  savePatch().catch(error => {
    setStatus(`Save failed: ${error.message}`, 'error');
  });
});

elements.clearPatchButton.addEventListener('click', () => {
  clearPatch().catch(error => {
    setStatus(`Clear failed: ${error.message}`, 'error');
  });
});

elements.exportJsonButton.addEventListener('click', () => {
  exportLocaleJson().catch(error => {
    setStatus(`Export failed: ${error.message}`, 'error');
  });
});

Promise.all([fetchDevices()])
  .then(() => {
    setStatus('Ready. Select a device to start editing.', 'success');
    scheduleAutoRefresh();
  })
  .catch(error => {
    setStatus(`Initial load failed: ${error.message}`, 'error');
  });
