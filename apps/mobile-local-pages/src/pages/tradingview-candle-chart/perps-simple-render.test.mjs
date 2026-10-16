import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../..',
);
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const base = path.join(
  root,
  'apps/mobile-local-pages/src/pages/tradingview-candle-chart',
);
const { appendSimplePriceGuide } = await import(
  pathToFileURL(path.join(base, 'perps-simple-price-guide.ts'))
);
const { avoidSimpleLabelOverlap, layoutSimplePriceLabels, visibleLastCandle } =
  await import(pathToFileURL(path.join(base, 'perps-simple-logic.ts')));
const source = fs.readFileSync(path.join(base, 'perps-simple.ts'), 'utf8');
const ast = ts.createSourceFile(
  'chart.ts',
  source,
  ts.ScriptTarget.Latest,
  true,
);
let render;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'render')
    render = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(render);
const js = ts.transpileModule(render, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
// Execute the production render function and its real geometry helpers. Only
// DOM measurement and the external chart's coordinate API are boundary fakes.
function scene({
  style,
  neutral,
  direction,
  selection,
  samePrice,
  x = 120,
  marketY = 110,
  historyPrice,
  rangeTo = 1,
  positionPrice,
  selectionColors = true,
}) {
  const document = {
    createElement(name) {
      return element(name);
    },
    createElementNS(namespace, name) {
      return element(name);
    },
  };
  function element(name) {
    return {
      name,
      ownerDocument: document,
      dataset: {},
      attributes: {},
      children: [],
      style: {
        setProperty(k, v) {
          this[k] = v;
        },
      },
      setAttribute(k, v) {
        this.attributes[k] = v;
      },
      getAttribute(k) {
        return this.attributes[k];
      },
      append(...children) {
        this.children.push(...children);
      },
      appendChild(child) {
        this.children.push(child);
      },
      replaceChildren(...children) {
        this.children = children;
      },
      getBoundingClientRect() {
        return { width: name === 'overlay' ? 381 : 44 };
      },
    };
  }
  const overlay = element('overlay');
  const candles = [
    {
      time: 60,
      open: 120,
      close: historyPrice ?? (samePrice ? 110 : 100),
      high: 125,
      low: 90,
    },
    {
      time: 120,
      open: direction === 'up' ? 100 : 120,
      close: 110,
      high: 125,
      low: 90,
    },
  ];
  const selected = selection === null ? null : candles[selection];
  const config = {
    style,
    colors: {
      accent: '#23C0B0',
      entry: neutral,
      up: '#36B16D',
      down: '#E85046',
      contrast: '#fff',
      background: '#fff',
      entryBackground: neutral,
      entryText: '#fff',
      liquidation: '#FF9F43',
      ...(selectionColors
        ? {
            selectionBackground: neutral === '#6A7587' ? '#000' : '#D3D8E0',
            selectionText: neutral === '#6A7587' ? '#fff' : '#000',
          }
        : {}),
    },
    labels: { entry: 'Entry', tp: 'TP', sl: 'SL', liq: 'Liq' },
  };
  const range = { from: 0, to: rangeTo };
  const series = {
    priceToCoordinate: p => p - 110 + marketY,
    priceScale: () => ({ options: () => ({ autoScale: true }) }),
  };
  const context = {
    document,
    overlay,
    config,
    candles,
    selectedTime: selected?.time ?? null,
    candleByTime: new Map(candles.map(c => [c.time, c])),
    prices: Object.fromEntries(
      ['entryPrice', 'tpPrice', 'slPrice', 'liquidationPrice'].map(k => [
        k,
        positionPrice ?? selected?.close ?? 110,
      ]),
    ),
    chart: {
      timeScale: () => ({
        getVisibleLogicalRange: () => range,
        width: () => 340,
        timeToCoordinate: () => x,
      }),
      panes: () => [{ getHeight: () => 274 }],
    },
    activeSeries: () => series,
    priceText: String,
    emit() {},
    priceAxis: { layout() {} },
    nativePriceAxis: { session: 0 },
    identity: 'probe',
    replacementSequence: 1,
    viewportState: '',
    defaultViewport: range,
    userViewportChanged: false,
    dirty: false,
    active: true,
    markers: [],
    historyPending: false,
    exhausted: true,
    historyRetryBlocked: false,
    applying: false,
    appendSimplePriceGuide,
    avoidSimpleLabelOverlap,
    layoutSimplePriceLabels,
    visibleLastCandle,
  };
  vm.runInNewContext(js + '\nrender();', context);
  assert.equal(overlay.style.height, '274px');
  const labels = overlay.children.filter(n => 'simplePriceLabel' in n.dataset);
  const guides = overlay.children.filter(n => 'simplePriceLine' in n.dataset);
  const cross = overlay.children.filter(n => 'simpleCrosshair' in n.dataset);
  for (const label of labels) {
    const isSelection =
      label.dataset.priceKind === 'selection' ||
      (label.dataset.priceKind === 'latest' && selected?.close === 110);
    if (isSelection) {
      assert.equal(
        label.style.background,
        config.colors.selectionBackground ?? config.colors.accent,
      );
      assert.equal(label.style.color, config.colors.selectionText ?? '#fff');
      assert.equal(
        Number.parseFloat(label.style.top) + 7,
        selected.close - 110 + marketY,
      );
      assert.equal(label.style.height, '14px');
      assert.equal(label.style.padding, '0 3px');
      assert.equal(label.style.borderRadius, '4px');
      assert.equal(label.style.fontSize, '10px');
      assert.equal(label.style.lineHeight, '14px');
      for (const other of labels.filter(n => n !== label))
        assert.ok(Number(label.style.zIndex) > Number(other.style.zIndex));
    } else if (label.dataset.priceKind === 'latest') {
      assert.equal(label.style.background, config.colors.accent);
    }
  }
  const hasCross =
    selected !== null &&
    x >= 0 &&
    x <= 340 &&
    selected.close - 110 + marketY >= 0 &&
    selected.close - 110 + marketY <= 274;
  assert.equal(cross.length, hasCross ? 1 : 0);
  if (hasCross) {
    const line = cross[0].children[0];
    assert.equal(line.attributes.stroke, neutral);
    assert.equal(line.attributes['stroke-width'], '1');
    assert.equal(line.attributes['stroke-dasharray'], '1 1');
    assert.ok(!line.attributes.d.includes('C '));
    for (const label of labels.filter(n => n.style.zIndex === '2'))
      assert.ok(Number(cross[0].style.zIndex) > Number(label.style.zIndex));
    assert.ok(
      line.attributes.d.startsWith(`M 0 ${selected.close - 110 + marketY} `),
    );
    assert.ok(line.attributes.d.endsWith(`M ${x} 4 V 274`));
    assert.equal(
      cross[0].children.filter(n => n.name === 'circle').length,
      style === 'area' ? 2 : 0,
    );
    assert.ok(!guides.some(n => n.dataset.priceKind === 'selection'));
    assert.equal(
      guides.some(n => n.dataset.priceKind === 'latest'),
      selected.close !== 110,
    );
  } else {
    assert.ok(guides.some(n => n.dataset.priceKind === 'latest'));
  }
  const latestLabel = labels.find(n => n.dataset.priceKind === 'latest');
  assert.equal(
    Number.parseFloat(latestLabel.style.top) + 7,
    selected?.close === 110 ? marketY : Math.min(267, Math.max(7, marketY)),
  );
  const marketGuide = guides.find(n => n.dataset.priceKind === 'latest');
  if (marketGuide) {
    assert.ok(!marketGuide.children[0].attributes.d.includes('C '));
    assert.ok(
      marketGuide.children[0].attributes.d.startsWith(`M 0 ${marketY} H `),
    );
  }
  if (hasCross && selected.close === 110) {
    assert.ok(!cross[0].children[0].attributes.d.includes('C '));
    assert.equal(
      labels.filter(n => n.dataset.priceKind === 'selection').length,
      0,
    );
  }
  if (style === 'candle') {
    if (marketY === 110 && selection === null)
      assert.ok(
        guides
          .filter(n => n.dataset.priceKind !== 'latest')
          .some(n => n.children[0].attributes.d.includes('C ')),
      );
    for (const id of ['entry', 'tp', 'sl', 'liquidation']) {
      const guide = guides.find(n => n.dataset.priceKind === id);
      assert.ok(guide, `Missing same-price position guide ${id}`);
      assert.equal(guide.children[0].attributes['stroke-dasharray'], '4 2');
    }
  }
  return { labels, guides, cross };
}
test('production Simple render pins market guides and preserves curved references and neutral crosshairs', () => {
  let count = 0;
  for (const style of ['candle', 'area'])
    for (const neutral of ['#6A7587', '#BABEC5'])
      for (const direction of ['up', 'down'])
        for (const selection of [null, 0, 1])
          for (const samePrice of [false, true]) {
            scene({ style, neutral, direction, selection, samePrice });
            count++;
          }
  for (const marketY of [0, 1, 7, 267, 273, 274]) {
    scene({
      style: 'candle',
      neutral: '#6A7587',
      direction: 'up',
      selection: null,
      samePrice: false,
      marketY,
    });
    count++;
  }
  for (const style of ['candle', 'area'])
    for (const x of [-1, 341]) {
      scene({
        style,
        neutral: '#6A7587',
        direction: 'up',
        selection: 0,
        samePrice: false,
        x,
      });
      count++;
    }
  for (const style of ['candle', 'area']) {
    for (const historyPrice of [109.9, 110.1]) {
      scene({
        style,
        neutral: '#6A7587',
        direction: 'up',
        selection: 0,
        samePrice: false,
        historyPrice,
      });
      count++;
    }
  }
  for (const selection of [null, 0]) {
    scene({
      style: 'area',
      neutral: '#BABEC5',
      direction: 'down',
      selection,
      samePrice: false,
      rangeTo: 0,
    });
    count++;
  }
  assert.equal(count, 64);
});

test('held prices cover crowded labels without moving ordinary labels, including clipped edges', () => {
  for (const style of ['candle', 'area'])
    for (const neutral of ['#6A7587', '#BABEC5'])
      for (const marketY of [0, 1, 7, 110, 267, 273, 274]) {
        const options = {
          style,
          neutral,
          direction: 'up',
          samePrice: false,
          marketY,
          positionPrice: 110,
        };
        const ordinary = scene({ ...options, selection: null });
        // Distinct prices closer than half a pixel must still have a straight
        // selection guide above the fixed market guide and ordinary badges.
        const held = scene({ ...options, selection: 0, historyPrice: 110.1 });
        for (const label of held.labels.filter(
          n => n.dataset.priceKind !== 'selection',
        )) {
          const original = ordinary.labels.find(
            n => n.dataset.priceKind === label.dataset.priceKind,
          );
          assert.equal(label.style.top, original.style.top);
        }
        scene({ ...options, selection: 1 });
        scene({ ...options, selection: 1, selectionColors: false });
      }
});

// Execute the production formatter and emitter, with external libraries unused
// by date formatting stubbed at their module boundary.
test('selection events carry exactly the crosshair formatter output, including old years and midnight', () => {
  const exports = {};
  const formatterJs = ts.transpileModule(
    fs.readFileSync(path.join(base, 'chart-logic.ts'), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText;
  vm.runInNewContext(formatterJs, {
    exports,
    require: name =>
      name === 'lightweight-charts/standalone' ? {} : require(name),
  });
  let emitter;
  function findEmitter(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(ast) === 'emitSelection'
    )
      emitter = node.getText(ast);
    ts.forEachChild(node, findEmitter);
  }
  findEmitter(ast);
  assert.ok(emitter);
  const code = ts.transpileModule(`const ${emitter};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const events = [];
  const context = {
    emit: event => events.push(event),
    formatTime: exports.formatTime,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  for (const date of [
    new Date(2026, 9, 15, 16, 57),
    new Date(2025, 4, 8, 7, 56),
    new Date(2026, 0, 1, 0, 5),
  ]) {
    context.candle = { time: date.getTime() / 1000, close: 100 };
    vm.runInContext('emitSelection(candle)', context);
    assert.equal(
      events.at(-1).timeText,
      exports.formatTime(context.candle.time),
    );
    assert.match(
      events.at(-1).timeText,
      /^[A-Z][a-z]{2} \d{2} [A-Z][a-z]{2} '\d{2} \d{2}:\d{2}$/,
    );
    assert.equal(events.at(-1).candle, context.candle);
  }
  vm.runInContext('emitSelection(null)', context);
  assert.equal(events.at(-1).timeText, '');
  assert.equal(events.at(-1).candle, null);
});
