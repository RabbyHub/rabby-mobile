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
// Execute production render/helpers; only DOM and chart coordinates are faked.
function scene(style, marketY, selectedPrice, dark = false) {
  function element(name) {
    return {
      name,
      ownerDocument: document,
      dataset: {},
      attributes: {},
      children: [],
      style: {
        setProperty(key, value) {
          this[key] = value;
        },
      },
      setAttribute(key, value) {
        this.attributes[key] = value;
      },
      getAttribute(key) {
        return this.attributes[key];
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
  const document = {
    createElement: element,
    createElementNS: (_namespace, name) => element(name),
  };
  const overlay = element('overlay');
  const candles = [selectedPrice ?? 100, 110].map((close, i) => ({
    time: 60 * (i + 1),
    open: 100,
    high: 125,
    low: 90,
    close,
  }));
  const colors = {
    accent: '#23C0B0',
    entry: dark ? '#BABEC5' : '#6A7587',
    up: '#36B16D',
    down: '#E85046',
    contrast: '#fff',
    background: '#fff',
    entryBackground: '#888',
    entryText: '#fff',
    liquidation: '#FF9F43',
    selectionBackground: dark ? '#D3D8E0' : '#000',
    selectionText: dark ? '#000' : '#fff',
  };
  const range = { from: 0, to: 1 };
  const context = {
    document,
    overlay,
    candles,
    config: {
      style,
      colors,
      labels: { entry: 'Entry', tp: 'TP', sl: 'SL', liq: 'Liq' },
    },
    selectedTime: selectedPrice === null ? null : 60,
    candleByTime: new Map(candles.map(c => [c.time, c])),
    prices: {
      entryPrice: 110,
      tpPrice: 110,
      slPrice: 110,
      liquidationPrice: 110,
    },
    chart: {
      timeScale: () => ({
        getVisibleLogicalRange: () => range,
        width: () => 340,
        timeToCoordinate: () => 120,
      }),
      panes: () => [{ getHeight: () => 274 }],
    },
    activeSeries: () => ({
      priceToCoordinate: price => price - 110 + marketY,
      priceScale: () => ({ options: () => ({ autoScale: true }) }),
    }),
    priceText: String,
    emit() {},
    priceAxis: { layout() {} },
    nativePriceAxis: { session: 0 },
    identity: 'test',
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
  const cross = overlay.children.find(n => 'simpleCrosshair' in n.dataset);
  const latest = labels.find(n => n.dataset.priceKind === 'latest');
  const guide = guides.find(n => n.dataset.priceKind === 'latest');
  if (selectedPrice !== 110) {
    assert.equal(
      Number.parseFloat(latest.style.top) + 7,
      Math.max(7, Math.min(267, marketY)),
    );
    assert.equal(latest.style.background, colors.accent);
    assert.ok(guide);
    assert.match(
      guide.children[0].attributes.d,
      new RegExp(`^M 0 ${marketY} H `),
    );
    assert.ok(!guide.children[0].attributes.d.includes('C '));
  } else {
    assert.equal(guide, undefined);
    assert.equal(
      labels.filter(n => n.dataset.priceKind === 'selection').length,
      0,
    );
  }
  if (selectedPrice !== null) {
    const held =
      selectedPrice === 110
        ? latest
        : labels.find(n => n.dataset.priceKind === 'selection');
    const y = selectedPrice - 110 + marketY;
    assert.equal(Number.parseFloat(held.style.top) + 7, y);
    assert.equal(held.style.background, colors.selectionBackground);
    assert.equal(held.style.color, colors.selectionText);
    assert.ok(cross);
    const line = cross.children[0].attributes;
    assert.ok(line.d.startsWith(`M 0 ${y} H `));
    assert.ok(!line.d.includes('C '));
    assert.equal(line['stroke-dasharray'], '1 1');
    assert.equal(line.stroke, colors.entry);
    for (const ordinary of labels.filter(n => n !== held))
      assert.ok(Number(cross.style.zIndex) > Number(ordinary.style.zIndex));
    assert.ok(Number(held.style.zIndex) > Number(cross.style.zIndex));
  } else assert.equal(cross, undefined);
  if (style === 'candle')
    for (const id of ['entry', 'tp', 'sl', 'liquidation'])
      assert.ok(guides.some(n => n.dataset.priceKind === id));
  return labels;
}

test('latest stays horizontal and held prices overlay ordinary labels without shifting them', () => {
  for (const style of ['candle', 'area'])
    for (const dark of [false, true])
      for (const marketY of [0, 110, 274]) {
        const ordinary = scene(style, marketY, null, dark);
        // A distinct price within half a pixel must not consume the latest line.
        const held = scene(
          style,
          marketY,
          marketY === 274 ? 109.9 : 110.1,
          dark,
        );
        for (const label of ordinary)
          assert.equal(
            held.find(n => n.dataset.priceKind === label.dataset.priceKind)
              .style.top,
            label.style.top,
          );
        scene(style, marketY, 110, dark);
      }
});
