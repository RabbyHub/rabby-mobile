import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  TrackingModeExitMode,
  type UTCTimestamp,
  type Time,
} from 'lightweight-charts/standalone';
import { attachSimplePriceAxis } from './perps-simple-axis';
import { createSimpleNativePriceAxis } from './perps-simple-native-axis';
import { formatTime, formatYTime } from './chart-logic';
import { PERPS_PRO_FONT_FAMILY } from './perps-pro-font';
import {
  avoidSimpleLabelOverlap,
  layoutSimplePriceLabels,
  simpleDefaultRange,
  simpleFillMarkers,
  simpleHistoryShift,
  simpleRangeReference,
  simpleRangeCoverage,
  visibleLastCandle,
} from './perps-simple-logic';
import { appendSimplePriceGuide } from './perps-simple-price-guide';
import type {
  CandleStick,
  SimpleChartMessage,
  SimpleChartConfig,
  SimpleChartEvent,
  SimpleChartFill,
  SimpleRangeCoverage,
} from './types';

export function createSimpleChart(
  container: HTMLElement,
  publish: (event: SimpleChartEvent) => void,
) {
  const host = document.createElement('div');
  Object.assign(host.style, {
    position: 'absolute',
    inset: '12px 0 8px 12px',
    touchAction: 'pan-y',
  });
  container.appendChild(host);
  const chart = createChart(host, {
    autoSize: true,
    layout: {
      fontFamily: PERPS_PRO_FONT_FAMILY,
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { style: LineStyle.Dashed },
      horzLines: { style: LineStyle.Dashed },
    },
    rightPriceScale: {
      borderVisible: false,
      minimumWidth: 0,
      scaleMargins: { top: 0.08, bottom: 0.08 },
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
      minBarSpacing: 0.1,
      barSpacing: 10,
      rightOffset: 0,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkFormatter: (time: number, type: number) =>
        formatYTime(time, type),
    },
    localization: {
      timeFormatter: (time: Time) =>
        formatTime(typeof time === 'string' ? Date.parse(time) / 1000 : time),
    },
    crosshair: {
      mode: CrosshairMode.Magnet,
      horzLine: { visible: false, labelVisible: false },
      vertLine: { visible: false, labelVisible: true },
    },
    trackingMode: { exitMode: TrackingModeExitMode.OnTouchEnd },
    handleScroll: { vertTouchDrag: false },
  });
  const candleSeries = chart.addSeries(CandlestickSeries, {
    borderVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  const areaSeries = chart.addSeries(AreaSeries, {
    visible: false,
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    // Simple Area renders its crosshair and 9px/5px marker in one overlay.
    crosshairMarkerVisible: false,
  });
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: '3',
    fontFamily: PERPS_PRO_FONT_FAMILY,
  });
  host.appendChild(overlay);
  let identity = '';
  let sequence = -1;
  let config: SimpleChartConfig | null = null;
  let active = true;
  let candles: CandleStick[] = [];
  let fills: SimpleChartFill[] = [];
  const candleByTime = new Map<number, CandleStick>();
  let prices: Extract<SimpleChartMessage, { action: 'overlays' }>['prices'] =
    {};
  let markers: ReturnType<typeof simpleFillMarkers> = [];
  let referencePrice: number | null = null;
  let sourceStartTime: number | undefined;
  let coverage: SimpleRangeCoverage = { kind: 'unavailable', start: null };
  let awaitingApplied = false;
  let replacementSequence = -1;
  function updateReference() {
    const nextCoverage = config
      ? simpleRangeCoverage(candles, config, sourceStartTime)
      : { kind: 'unavailable' as const, start: null };
    const next =
      config && nextCoverage.kind === 'complete'
        ? simpleRangeReference(candles, config)
        : null;
    if (
      next === referencePrice &&
      nextCoverage.kind === coverage.kind &&
      nextCoverage.start === coverage.start
    )
      return;
    referencePrice = next;
    coverage = nextCoverage;
    if (active && !awaitingApplied)
      emit({ event: 'rangeReference', referencePrice, coverage } as Omit<
        SimpleChartEvent,
        'type' | 'identity'
      >);
  }

  function updateMarkers() {
    markers = config?.showTradeMarkers
      ? simpleFillMarkers(candles, fills, config.interval)
      : [];
  }
  let dirty = false;
  let defaultViewport: { from: number; to: number } | null = null;
  let userViewportChanged = false;
  let applying = false;
  let historyPending = false;
  let exhausted = false;
  let historyRetryBlocked = false;
  let frame: number | null = null;
  let viewportState = '';
  let selectedTime: number | null = null;
  let contact = false;
  let disposed = false;
  const activeSeries = () =>
    config?.style === 'area' ? areaSeries : candleSeries;
  const priceText = (price: number) =>
    price.toLocaleString('en-US', {
      minimumFractionDigits: config?.priceDecimals ?? 2,
      maximumFractionDigits: config?.priceDecimals ?? 2,
    });
  const emit = (event: Omit<SimpleChartEvent, 'type' | 'identity'>) =>
    publish({
      type: 'PERPS_SIMPLE_EVENT',
      identity,
      ...event,
    } as SimpleChartEvent);
  const emitSelection = (candle: CandleStick | null) =>
    emit({
      event: 'selection',
      candle,
      timeText: candle ? formatTime(candle.time) : '',
    } as Omit<SimpleChartEvent, 'type' | 'identity'>);
  const clearSelection = () => {
    chart.clearCrosshairPosition();
    if (selectedTime !== null) {
      selectedTime = null;
      emitSelection(null);
    }
  };
  function schedule() {
    if (frame !== null || disposed) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      render();
    });
  }
  function applyDefault() {
    priceAxis.cancel();
    nativePriceAxis.cancel();
    if (!config) return;
    const range = simpleDefaultRange(
      candles,
      config,
      chart.timeScale().width(),
    );
    if (!range) return;
    applying = true;
    activeSeries().priceScale().applyOptions({ autoScale: true });
    chart.timeScale().setVisibleLogicalRange(range);
    // fixRightEdge and pixel/bar constraints may clamp the requested range.
    defaultViewport = chart.timeScale().getVisibleLogicalRange();
    applying = false;
    dirty = false;
    userViewportChanged = false;
    schedule();
  }
  const priceAxis = attachSimplePriceAxis(host, {
    isActive: () =>
      !config?.nativePriceAxis && active && !!candles.length && !disposed,
    getRange: () => activeSeries().priceScale().getVisibleRange(),
    setRange: range => {
      activeSeries().priceScale().setVisibleRange(range);
      userViewportChanged = true;
      dirty = true;
      schedule();
    },
    onStart: () => {
      contact = false;
      clearSelection();
    },
  });
  const nativePriceAxis = createSimpleNativePriceAxis({
    isActive: () =>
      !!config?.nativePriceAxis &&
      active &&
      !!candles.length &&
      !awaitingApplied &&
      !disposed,
    getRange: () => activeSeries().priceScale().getVisibleRange(),
    getHeight: () => chart.panes()[0].getHeight(),
    setRange: range => {
      activeSeries().priceScale().setVisibleRange(range);
      userViewportChanged = true;
      dirty = true;
      schedule();
    },
    onStart: () => {
      contact = false;
      clearSelection();
      schedule();
    },
  });
  function render() {
    overlay.replaceChildren();
    if (!config) return;
    const { up: GREEN, down: RED, accent: ACCENT } = config.colors;
    const range = chart.timeScale().getVisibleLogicalRange();
    const defaultRange = defaultViewport;
    if (!userViewportChanged) defaultViewport = range;
    dirty =
      userViewportChanged &&
      !!range &&
      !!defaultRange &&
      (Math.abs(range.from - defaultRange.from) > 0.1 ||
        Math.abs(range.to - defaultRange.to) > 0.1 ||
        !activeSeries().priceScale().options().autoScale);
    const last = candles[candles.length - 1];
    const visible = visibleLastCandle(candles, range);
    const lastVisible =
      !!last &&
      !!range &&
      range.to >= candles.length - 1 &&
      range.from <= candles.length - 1;
    const paneWidth = chart.timeScale().width();
    const paneHeight = chart.panes()[0].getHeight();
    priceAxis.layout(paneWidth, paneHeight);
    const state = `${identity}:${replacementSequence}:${
      nativePriceAxis.session
    }:${config.style}:${dirty}:${
      !lastVisible && !!last
    }:${paneWidth}:${paneHeight}`;
    if (state !== viewportState) {
      viewportState = state;
      emit({
        event: 'viewport',
        presentationSequence: replacementSequence,
        priceAxisSession: nativePriceAxis.session,
        style: config.style,
        resetVisible: dirty,
        latestVisible: !lastVisible && !!last,
        paneWidth,
        paneHeight,
      } as Omit<SimpleChartEvent, 'type' | 'identity'>);
    }
    if (!last || !range) return;
    const series = activeSeries();
    const tags: Array<{
      id: string;
      price: number;
      color: string;
      background: string;
      text: string;
      title?: string;
      outline?: boolean;
    }> = [];
    // Market price guides use the fixed accent, independently of candle direction.
    tags.push({
      id: 'latest',
      price: last.close,
      color: ACCENT,
      background: ACCENT,
      text: config.colors.contrast,
    });
    if (config.style === 'area' && !lastVisible && visible) {
      tags.push({
        id: 'viewport',
        price: visible.close,
        color: ACCENT,
        background: config.colors.background,
        text: ACCENT,
        outline: true,
      });
    }
    const selected =
      selectedTime === null ? null : candleByTime.get(selectedTime);
    if (selected && selected.close !== last.close) {
      tags.push({
        id: 'selection',
        price: selected.close,
        color: ACCENT,
        background: ACCENT,
        text: config.colors.contrast,
      });
    }
    if (config.style === 'candle') {
      const lines = [
        {
          id: 'entry',
          price: prices.entryPrice,
          color: config.colors.entry,
          background: config.colors.entryBackground,
          text: config.colors.entryText,
          title: config.labels.entry,
        },
        {
          id: 'tp',
          price: prices.tpPrice,
          color: GREEN,
          background: GREEN,
          text: config.colors.contrast,
          title: config.labels.tp,
        },
        {
          id: 'sl',
          price: prices.slPrice,
          color: RED,
          background: RED,
          text: config.colors.contrast,
          title: config.labels.sl,
        },
        {
          id: 'liquidation',
          price: prices.liquidationPrice,
          color: config.colors.liquidation,
          background: config.colors.liquidation,
          text: config.colors.contrast,
          title: config.labels.liq,
        },
      ];
      for (const line of lines)
        if (Number.isFinite(line.price) && line.price! > 0)
          tags.push({ ...line, price: line.price! });
    }
    const visibleTags = tags
      .map(tag => ({ ...tag, y: series.priceToCoordinate(tag.price) }))
      .filter(
        tag =>
          tag.y !== null &&
          (tag.title === undefined || (tag.y >= 0 && tag.y <= paneHeight)),
      );
    const latestIndex = visibleTags.findIndex(tag => tag.id === 'latest');
    const tagY = layoutSimplePriceLabels(
      visibleTags.map(tag => tag.y!),
      paneHeight,
      latestIndex,
    );
    const titledTags = visibleTags.filter(tag => tag.title !== undefined);
    const titleY = avoidSimpleLabelOverlap(
      // 16px title sits 1px above its undisplaced reference line.
      titledTags.map(tag => tag.y! - 9),
      paneHeight,
      18, // 16px text box plus 1px outside glyph stroke on each side.
    );
    // Append all labels, read their actual bounds together, then draw lines.
    // No opaque full-axis row: only the 14px label covers chart content.
    const labels = visibleTags.map((tag, i) => {
      const label = document.createElement('span');
      label.textContent = priceText(tag.price);
      label.dataset.simplePriceLabel = '';
      label.dataset.priceKind = tag.id;
      Object.assign(label.style, {
        position: 'absolute',
        right: '12px',
        top: `${tagY[i] - 7}px`,
        height: '14px',
        padding: '0 3px',
        borderRadius: '4px',
        fontSize: '10px',
        lineHeight: '14px',
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
        color: tag.text,
        background: tag.background,
        boxShadow: tag.outline ? `inset 0 0 0 1px ${tag.color}` : 'none',
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        zIndex: '2',
      });
      overlay.appendChild(label);
      return label;
    });
    const titles = titledTags.map((tag, i) => {
      const title = document.createElement('span');
      // Separate stroke/fill layers preserve the glyph fill on older WebViews
      // without depending on CSS paint-order support for text.
      const outline = document.createElement('span');
      outline.textContent = tag.title!;
      outline.setAttribute('aria-hidden', 'true');
      Object.assign(outline.style, {
        position: 'absolute',
        inset: '0',
      });
      outline.style.setProperty(
        '-webkit-text-stroke',
        `2px ${config!.colors.titleOutline ?? config!.colors.background}`,
      );
      const fill = document.createElement('span');
      fill.textContent = tag.title!;
      fill.style.position = 'relative';
      title.append(outline, fill);
      title.dataset.simplePriceTitle = tag.id;
      Object.assign(title.style, {
        position: 'absolute',
        left: '1px', // Keep the outside stroke within the clipped plot overlay.
        top: `${titleY[i] - 8}px`,
        height: '16px',
        color: tag.color,
        fontSize: '10px',
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        zIndex: '2',
      });
      overlay.appendChild(title);
      return title;
    });
    // Batch layout reads before writes. Tabular digits alone do not equalize
    // values with different digit counts (for example 99.90 and 100.10).
    const overlayWidth = overlay.getBoundingClientRect().width;
    const labelWidth = Math.max(
      0,
      ...labels.map(label => label.getBoundingClientRect().width),
    );
    const titleWidths = titles.map(
      title => title.getBoundingClientRect().width,
    );
    labels.forEach(label => {
      label.style.width = `${labelWidth}px`;
    });
    const labelLeft = Math.max(0, overlayWidth - 12 - labelWidth);
    const selectedX = selected
      ? chart.timeScale().timeToCoordinate(selected.time as UTCTimestamp)
      : null;
    const selectedY = selected
      ? series.priceToCoordinate(selected.close)
      : null;
    const crosshair =
      selectedX !== null &&
      selectedY !== null &&
      selectedX >= 0 &&
      selectedX <= paneWidth &&
      selectedY >= 0 &&
      selectedY <= paneHeight
        ? { x: selectedX, y: selectedY }
        : null;
    visibleTags.forEach((tag, i) => {
      const y = tag.y!;
      if (y < 0 || y > paneHeight) return;
      // The neutral crosshair owns overlapping market price guides. Position
      // guides keep their independent meaning even at the selected price.
      if (
        crosshair &&
        (tag.id === 'selection' ||
          (tag.id === 'latest' && tag.price === selected?.close) ||
          (tag.id === 'viewport' && Math.abs(y - crosshair.y) < 0.5))
      )
        return;
      const titleIndex = titledTags.indexOf(tag);
      const displacedTitle =
        titleIndex >= 0 && Math.abs(titleY[titleIndex] + 9 - y) > 0.5
          ? {
              right: titleWidths[titleIndex] + 2,
              bottom: titleY[titleIndex] + 9,
            }
          : undefined;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.dataset.simplePriceLine = '';
      svg.dataset.priceKind = tag.id;
      Object.assign(svg.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: `${paneHeight}px`,
        overflow: 'hidden',
      });
      appendSimplePriceGuide(
        svg,
        {
          priceY: y,
          labelX: labelLeft,
          // Edge clamping affects the badge rectangle, never the market line.
          labelY: tag.id === 'latest' ? y : tagY[i],
          title: displacedTitle,
        },
        tag.color,
        '4 2',
      );
      overlay.appendChild(svg);
    });
    if (crosshair) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.dataset.simpleCrosshair = '';
      Object.assign(svg.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: `${paneHeight}px`,
        overflow: 'hidden',
        zIndex: '1',
      });
      const selectedIndex = visibleTags.findIndex(
        tag =>
          tag.id === (selected?.close === last.close ? 'latest' : 'selection'),
      );
      const axisY =
        selectedIndex >= 0 && visibleTags[selectedIndex].id !== 'latest'
          ? tagY[selectedIndex]
          : crosshair.y;
      const path = appendSimplePriceGuide(
        svg,
        { priceY: crosshair.y, labelX: labelLeft, labelY: axisY },
        config.colors.entry,
        '1 1',
      );
      path.setAttribute(
        'd',
        `${path.getAttribute('d')} M ${crosshair.x} 4 V ${paneHeight}`,
      );
      // This is a data-positioned chart marker, not a static UI icon.
      if (config.style === 'area') {
        for (const [radius, opacity] of [
          [4.5, 0.15],
          [2.5, 1],
        ]) {
          const dot = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'circle',
          );
          dot.setAttribute('cx', String(crosshair.x));
          dot.setAttribute('cy', String(crosshair.y));
          dot.setAttribute('r', String(radius));
          dot.setAttribute('fill', ACCENT);
          dot.setAttribute('fill-opacity', String(opacity));
          svg.appendChild(dot);
        }
      }
      overlay.appendChild(svg);
    }
    const firstVisibleTime = candles[Math.max(0, Math.floor(range.from))]?.time;
    const lastVisibleTime =
      candles[Math.min(candles.length - 1, Math.ceil(range.to))]?.time;
    for (const marker of markers) {
      if (marker.time < firstVisibleTime || marker.time > lastVisibleTime)
        continue;
      const x = chart.timeScale().timeToCoordinate(marker.time as UTCTimestamp);
      if (x === null || x < 0 || x > paneWidth) continue;
      const candle = candleByTime.get(marker.time);
      if (!candle) continue;
      const buy = marker.side === 'B';
      const y = series.priceToCoordinate(
        config.style === 'area' ? candle.close : buy ? candle.low : candle.high,
      );
      if (y === null || y < 0 || y > paneHeight) continue;
      const label = document.createElement('span');
      label.textContent = buy ? 'B' : 'S';
      label.setAttribute(
        'aria-label',
        buy ? config.labels.buy : config.labels.sell,
      );
      Object.assign(label.style, {
        position: 'absolute',
        left: `${x - 6}px`,
        top: `${Math.max(0, Math.min(paneHeight - 12, y + (buy ? 4 : -16)))}px`,
        width: '12px',
        height: '12px',
        borderRadius: buy ? '3px' : '4px',
        color: config.colors.contrast,
        background: buy ? GREEN : RED,
        fontSize: '9px',
        lineHeight: '12px',
        fontWeight: '700',
        textAlign: 'center',
      });
      overlay.appendChild(label);
    }
    if (
      active &&
      range.from < 5 &&
      !historyPending &&
      !exhausted &&
      !historyRetryBlocked &&
      !applying
    ) {
      historyPending = true;
      emit({ event: 'history' });
    }
  }
  chart.timeScale().subscribeVisibleLogicalRangeChange(schedule);
  chart.subscribeCrosshairMove(event => {
    if (!active || !contact || event.time === undefined) return;
    const candle = candleByTime.get(Number(event.time));
    if (!candle || selectedTime === candle.time) return;
    selectedTime = candle.time;
    schedule();
    emitSelection(candle);
  });
  const start = () => {
    contact = true;
  };
  const move = () => {
    if (contact && selectedTime === null) {
      userViewportChanged = true;
      historyRetryBlocked = false;
    }
    schedule();
  };
  const end = () => {
    contact = false;
    clearSelection();
    schedule();
  };
  const wheel = () => {
    userViewportChanged = true;
    historyRetryBlocked = false;
    schedule();
  };
  host.addEventListener('touchstart', start, { passive: true });
  host.addEventListener('touchmove', move, { passive: true });
  host.addEventListener('touchend', end);
  host.addEventListener('touchcancel', end);
  host.addEventListener('mousedown', start);
  host.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  host.addEventListener('wheel', wheel, { passive: true });
  const resize = new ResizeObserver(() => {
    if (!dirty) applyDefault();
    else schedule();
  });
  resize.observe(host);
  return {
    handle(message: SimpleChartMessage) {
      if (message.sequence <= sequence) return false;
      if (
        identity &&
        message.action !== 'replace' &&
        message.identity !== identity
      )
        return false;
      sequence = message.sequence;
      if (message.action === 'configure' || message.action === 'replace') {
        const changed =
          identity !== message.identity || message.action === 'replace';
        const styleChanged = config?.style !== message.config.style;
        const axisModeChanged =
          config?.nativePriceAxis !== message.config.nativePriceAxis;
        const range = chart.timeScale().getVisibleLogicalRange();
        identity = message.identity;
        config = message.config;
        if (message.action === 'replace') {
          awaitingApplied = true;
          replacementSequence = message.sequence;
        }
        if (changed || styleChanged || axisModeChanged) {
          priceAxis.cancel();
          nativePriceAxis.cancel();
        }
        if (changed) {
          clearSelection();
          candles = [];
          fills = [];
          markers = [];
          referencePrice = null;
          sourceStartTime = undefined;
          coverage = { kind: 'unavailable', start: null };
          prices = {};
          candleByTime.clear();
          historyPending = false;
          exhausted = false;
          historyRetryBlocked = false;
          dirty = false;
          defaultViewport = null;
          userViewportChanged = false;
          if (message.action !== 'replace') {
            candleSeries.setData([]);
            areaSeries.setData([]);
          }
        }
        host.style.background = config.colors.background;
        document.body.style.background = config.colors.background;
        const priceFormat = {
          type: 'price' as const,
          precision: config.priceDecimals,
          minMove: 10 ** -config.priceDecimals,
        };
        candleSeries.applyOptions({
          visible: config.style === 'candle',
          priceFormat,
          upColor: config.colors.up,
          downColor: config.colors.down,
          wickUpColor: config.colors.up,
          wickDownColor: config.colors.down,
        });
        areaSeries.applyOptions({
          visible: config.style === 'area',
          priceFormat,
          lineColor: config.colors.accent,
          topColor: config.colors.areaTop,
          bottomColor: config.colors.areaBottom,
        });
        chart.applyOptions({
          layout: {
            background: {
              type: ColorType.Solid,
              color: config.colors.background,
            },
            textColor: config.colors.secondary,
          },
          grid: {
            vertLines: { color: config.colors.grid },
            horzLines: { color: config.colors.grid },
          },
          crosshair: {
            vertLine: {
              visible: false,
              labelVisible: config.style === 'candle',
              color: config.colors.secondary,
              labelBackgroundColor: config.colors.entry,
            },
          },
        });
        updateMarkers();
        if (!changed && styleChanged && range)
          chart.timeScale().setVisibleLogicalRange(range);
        schedule();
        if (message.action === 'configure') return true;
      }
      if (message.action === 'data' || message.action === 'replace') {
        const range = chart.timeScale().getVisibleLogicalRange();
        const followedLatest = !!range && range.to >= candles.length - 1;
        const previousLatestTime = candles.at(-1)?.time;
        const shift = simpleHistoryShift(candles, message.candles);
        const hadData = candles.length > 0;
        candles = message.candles;
        sourceStartTime = message.sourceStartTime;
        candleByTime.clear();
        candles.forEach(candle => candleByTime.set(candle.time, candle));
        candleSeries.setData(
          candles.map(item => ({ ...item, time: item.time as UTCTimestamp })),
        );
        areaSeries.setData(
          candles.map(item => ({
            time: item.time as UTCTimestamp,
            value: item.close,
          })),
        );
        updateMarkers();
        if (message.action === 'data' && message.preserve && hadData && range) {
          if (defaultViewport)
            defaultViewport = {
              from: defaultViewport.from + shift,
              to: defaultViewport.to + shift,
            };
          if (
            followedLatest &&
            previousLatestTime !== undefined &&
            (candles.at(-1)?.time ?? previousLatestTime) > previousLatestTime
          ) {
            // A reconnect or a bounded tail trim may deliver several new bars
            // at once. Preserve zoom and the user's existing realtime follow.
            const to = candles.length - 0.5;
            chart.timeScale().setVisibleLogicalRange({
              from: to - (range.to - range.from),
              to,
            });
          } else
            chart.timeScale().setVisibleLogicalRange({
              from: range.from + shift,
              to: range.to + shift,
            });
        } else applyDefault();
        updateReference();
        if (message.action === 'replace') {
          const appliedIdentity = identity;
          requestAnimationFrame(() => {
            if (
              !disposed &&
              identity === appliedIdentity &&
              replacementSequence === message.sequence
            ) {
              awaitingApplied = false;
              emit({
                event: 'applied',
                sequence: message.sequence,
                referencePrice,
                coverage,
              } as Omit<SimpleChartEvent, 'type' | 'identity'>);
            }
          });
        }
        if (!candles.length) clearSelection();
        else if (selectedTime !== null) {
          const selected = candleByTime.get(selectedTime);
          if (selected) emitSelection(selected);
          else clearSelection();
        }
      } else if (message.action === 'activity') {
        if (active !== message.active) nativePriceAxis.cancel();
        active = message.active;
        host.style.pointerEvents = active ? 'auto' : 'none';
        if (!active) {
          priceAxis.cancel();
          contact = false;
          clearSelection();
          historyPending = false;
        } else historyRetryBlocked = false;
      } else if (message.action === 'priceAxis') {
        return nativePriceAxis.handle(message);
      } else if (message.action === 'update') {
        const candle = message.candle;
        const last = candles[candles.length - 1];
        if (!last || candle.time < last.time) return false;
        candleByTime.set(candle.time, candle);
        const range = chart.timeScale().getVisibleLogicalRange();
        const follow = range && range.to >= candles.length - 1;
        const appended = candle.time > last.time;
        if (appended) candles.push(candle);
        else candles[candles.length - 1] = candle;
        candleSeries.update({ ...candle, time: candle.time as UTCTimestamp });
        areaSeries.update({
          time: candle.time as UTCTimestamp,
          value: candle.close,
        });
        if (selectedTime === candle.time) emitSelection(candle);
        if (appended) {
          updateReference();
          if (defaultViewport)
            defaultViewport = {
              from: defaultViewport.from + 1,
              to: defaultViewport.to + 1,
            };
          updateMarkers();
          if (!dirty && !nativePriceAxis.dragging) applyDefault();
          else if (follow && range)
            chart.timeScale().setVisibleLogicalRange({
              from: range.from + 1,
              to: range.to + 1,
            });
        }
      } else if (message.action === 'overlays') {
        prices = message.prices;
        fills = config?.showTradeMarkers ? message.fills : [];
        updateMarkers();
      } else if (message.action === 'historyComplete') {
        historyPending = false;
        exhausted = message.outcome === 'exhausted';
        historyRetryBlocked = message.outcome === 'retry';
        // Retry only after another user gesture, not an immediate failure loop.
        if (historyRetryBlocked) return true;
      } else if (message.action === 'reset') {
        clearSelection();
        applyDefault();
      } else if (message.action === 'latest') {
        nativePriceAxis.cancel();
        clearSelection();
        const range = chart.timeScale().getVisibleLogicalRange();
        if (range)
          chart.timeScale().setVisibleLogicalRange({
            from: candles.length - 0.5 - (range.to - range.from),
            to: candles.length - 0.5,
          });
      } else if (message.action === 'clearSelection') clearSelection();
      schedule();
      return true;
    },
    refreshFonts() {
      chart.applyOptions({ layout: { fontFamily: PERPS_PRO_FONT_FAMILY } });
      schedule();
    },
    destroy() {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      resize.disconnect();
      priceAxis.destroy();
      nativePriceAxis.cancel();
      window.removeEventListener('mouseup', end);
      chart.remove();
      host.remove();
    },
  };
}
