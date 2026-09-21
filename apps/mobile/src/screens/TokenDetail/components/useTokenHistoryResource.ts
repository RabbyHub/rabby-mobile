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
  fetchPage,
}: {
  requestKey: string;
  enabled: boolean;
  pageSize: number;
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
        // A background DB upsert should not collapse a scrolled list to one
        // page. Re-read its current window, including an updated oldest cursor.
        const count =
          mode === 'revalidate'
            ? Math.max(pageSize, previous.list.length)
            : pageSize;
        const page = await fetchPageRef.current(
          mode === 'append' ? previous.cursor : 0,
          count,
        );
        if (!context.active || context.sequence !== sequence) return;

        // History is append-only here. An empty refresh is not evidence that
        // previously displayed transactions were deleted (e.g. DB sync in flight).
        const preserve =
          mode !== 'append' && !page.list.length && !!previous.list.length;
        const rows = new Map<string, T>();
        if (mode === 'append' || preserve) {
          previous.list.forEach(item => rows.set(item.key, item));
        }
        page.list.forEach(item => rows.set(item.key, item));
        const hasMore =
          page.list.length >= count &&
          page.last > 0 &&
          (mode !== 'append' || page.last < previous.cursor);
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
    [context, enabled, pageSize],
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
