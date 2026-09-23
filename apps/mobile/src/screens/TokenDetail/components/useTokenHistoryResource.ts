import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type HistoryRow = { key: string; time_at: number };
type HistoryPage<T> = { list: T[]; last: number };
type HistoryState<T> = {
  list: T[];
  cursor: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  firstFetchDone: boolean;
  error: unknown;
};

/** A request and its cursor belong to one account/token/source, never the next screen. */
export function useTokenHistoryResource<T extends HistoryRow>({
  requestKey,
  enabled,
  pageSize,
  maxPageSize,
  fetchPage,
}: {
  requestKey: string;
  enabled: boolean;
  pageSize: number;
  /** Maximum rows one transport request can ask for while revalidating. */
  maxPageSize?: number;
  fetchPage: (cursor: number, count: number) => Promise<HistoryPage<T>>;
}) {
  const fetchPageRef = useRef(fetchPage);
  useLayoutEffect(() => {
    fetchPageRef.current = fetchPage;
  });

  const context = useMemo(
    () => ({
      key: requestKey,
      active: false,
      sequence: 0,
      state: {
        list: [],
        cursor: 0,
        hasMore: enabled,
        loading: enabled,
        loadingMore: false,
        firstFetchDone: false,
        error: undefined,
      } as HistoryState<T>,
    }),
    [requestKey, enabled],
  );
  const [publication, setPublication] = useState({
    context,
    state: context.state,
  });

  const request = useCallback(
    async (mode: 'replace' | 'append' | 'revalidate') => {
      if (!enabled || !context.active) return;
      const previous = context.state;
      if (
        mode === 'append' &&
        (previous.loading ||
          previous.loadingMore ||
          !previous.firstFetchDone ||
          !previous.hasMore)
      )
        return;

      const sequence = ++context.sequence;
      const publish = (state: HistoryState<T>) => {
        context.state = state;
        setPublication({ context, state });
      };
      publish({
        ...previous,
        loading: mode !== 'append',
        loadingMore: mode === 'append',
        error: undefined,
      });
      try {
        // Revalidation should not collapse a scrolled list to one page. Re-read
        // its current window, including an updated oldest cursor.
        const count =
          mode === 'revalidate'
            ? Math.max(pageSize, previous.list.length)
            : pageSize;
        const fetchPageForRequest = fetchPageRef.current;
        const firstCursor = mode === 'append' ? previous.cursor : 0;
        const hasPageSizeCap =
          mode === 'revalidate' &&
          typeof maxPageSize === 'number' &&
          maxPageSize > 0;
        const revalidationPageSize = hasPageSizeCap
          ? Math.max(1, Math.floor(maxPageSize))
          : count;
        const pageBudget =
          mode === 'revalidate' ? Math.ceil(count / revalidationPageSize) : 1;
        const fetchedRows = new Map<string, T>();
        let nextCursor = firstCursor;
        let page: HistoryPage<T> = { list: [], last: 0 };
        let lastRequestCursor = firstCursor;
        let lastRequestCount = Math.min(count, revalidationPageSize);
        let lastPageLength = 0;

        for (let pageIndex = 0; pageIndex < pageBudget; pageIndex += 1) {
          const remaining = Math.max(1, count - fetchedRows.size);
          lastRequestCount = Math.min(remaining, revalidationPageSize);
          lastRequestCursor = nextCursor;
          page = await fetchPageForRequest(lastRequestCursor, lastRequestCount);
          if (!context.active || context.sequence !== sequence) return;

          page.list.forEach(item => fetchedRows.set(item.key, item));
          lastPageLength = page.list.length;

          const cursorAdvanced =
            page.last > 0 &&
            (lastRequestCursor === 0 || page.last < lastRequestCursor);
          if (
            fetchedRows.size >= count ||
            lastPageLength < lastRequestCount ||
            !cursorAdvanced
          ) {
            break;
          }
          nextCursor = page.last;
        }

        const fetchedList = Array.from(fetchedRows.values());
        // API history is append-only for this resource. If a capped
        // revalidation cannot rebuild the already displayed window, retain
        // the previous atomic snapshot instead of publishing a partial one.
        const finalCursorAdvanced =
          page.last > 0 &&
          (lastRequestCursor === 0 || page.last < lastRequestCursor);
        const incompleteCappedRevalidation =
          hasPageSizeCap &&
          previous.list.length > 0 &&
          (fetchedList.length < previous.list.length ||
            (previous.hasMore && !finalCursorAdvanced));
        if (incompleteCappedRevalidation) {
          publish({
            ...previous,
            loading: false,
            loadingMore: false,
            error: undefined,
          });
          return;
        }

        // History is append-only here. An empty refresh is not evidence that
        // previously displayed transactions were deleted (e.g. DB sync in flight).
        const preserve =
          mode !== 'append' && !fetchedList.length && !!previous.list.length;
        const rows = new Map<string, T>();
        if (mode === 'append' || preserve) {
          previous.list.forEach(item => rows.set(item.key, item));
        }
        fetchedList.forEach(item => rows.set(item.key, item));
        const hasMore =
          lastPageLength >= lastRequestCount && finalCursorAdvanced;
        publish({
          list: Array.from(rows.values()).sort((a, b) => b.time_at - a.time_at),
          cursor: preserve ? previous.cursor : page.last,
          hasMore: preserve ? previous.hasMore : hasMore,
          loading: false,
          loadingMore: false,
          firstFetchDone: true,
          error: undefined,
        });
      } catch (error) {
        if (!context.active || context.sequence !== sequence) return;
        // Keep both rows and cursor on failure, so the user can retry that page.
        publish({
          ...previous,
          loading: false,
          loadingMore: false,
          firstFetchDone: true,
          hasMore: previous.list.length ? previous.hasMore : false,
          error,
        });
      }
    },
    [context, enabled, maxPageSize, pageSize],
  );

  const refresh = useCallback(() => request('replace'), [request]);
  const loadMore = useCallback(() => request('append'), [request]);
  const revalidate = useCallback(() => request('revalidate'), [request]);
  useEffect(() => {
    context.active = true;
    void refresh();
    return () => {
      context.active = false;
      context.sequence += 1;
    };
  }, [context, refresh]);

  // Do not render the old account's rows during the render before effect cleanup.
  const state =
    publication.context === context ? publication.state : context.state;
  return { ...state, refresh, loadMore, revalidate };
}
