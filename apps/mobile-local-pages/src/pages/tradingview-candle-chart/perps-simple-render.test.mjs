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
const logic = await import(
  pathToFileURL(path.join(base, 'perps-simple-logic.ts'))
);
const { resolvePerpsProFontFamily } = await import(
  pathToFileURL(path.join(base, 'perps-pro-font.ts'))
);
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

// Font component contract: run the production factory with DOM/chart boundaries
// stubbed. Rendering helpers and geometry have separate coverage below.
function fontScene(platform) {
  const factory = ast.statements.find(
    node =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'createSimpleChart',
  );
  const factoryJs = ts.transpileModule(
    factory.getText(ast).replace(/^export /, ''),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  function element() {
    return {
      style: {},
      children: [],
      appendChild(child) {
        this.children.push(child);
      },
      addEventListener() {},
    };
  }
  const container = element();
  const appliedOptions = [];
  let initialOptions;
  const context = {
    platform,
    container,
    getRuntimeInfo: () => ({ platform: context.platform }),
    resolvePerpsProFontFamily,
    document: { createElement: element },
    window: { addEventListener() {} },
    createChart(_host, options) {
      initialOptions = options;
      return {
        addSeries: () => ({}),
        timeScale: () => ({ subscribeVisibleLogicalRangeChange() {} }),
        subscribeCrosshairMove() {},
        applyOptions: options => appliedOptions.push(options),
      };
    },
    CandlestickSeries: 'candle',
    AreaSeries: 'area',
    LineStyle: { Dashed: 'dashed' },
    LineType: { Simple: 'simple' },
    CrosshairMode: { Magnet: 'magnet' },
    TrackingModeExitMode: { OnTouchEnd: 'onTouchEnd' },
    attachSimplePriceAxis: () => ({}),
    createSimpleNativePriceAxis: () => ({}),
    requestAnimationFrame: () => 1,
    ResizeObserver: class {
      observe() {}
    },
  };
  const chart = vm.runInNewContext(
    factoryJs + '\ncreateSimpleChart(container, () => {});',
    context,
  );
  return {
    chart,
    context,
    initialOptions,
    appliedOptions,
    overlay: container.children[0].children[0],
  };
}

test('Simple chart starts with the platform family in both canvas and overlay', () => {
  for (const platform of ['ios', 'android']) {
    const { initialOptions, overlay } = fontScene(platform);
    const expected = resolvePerpsProFontFamily({ platform });
    assert.equal(initialOptions.layout.fontFamily, expected);
    assert.equal(overlay.style.fontFamily, expected);
  }
});

test('Simple runtime info refreshes fonts without waiting for iOS assets and after Android assets load', async () => {
  const entryAst = ts.createSourceFile(
    'index.tsx',
    fs.readFileSync(path.join(base, 'index.tsx'), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const handler = entryAst.statements.find(
    node =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'handleMessage',
  );
  const handlerJs = ts.transpileModule(handler.getText(entryAst), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const platform of ['ios', 'android']) {
    const scene = fontScene(platform === 'ios' ? 'android' : 'ios');
    scene.context.platform = platform;
    let finishFontLoad;
    const handlerContext = {
      simpleChart: scene.chart,
      perpsProFontLoadPromise: null,
      ensurePerpsProFontsLoaded() {
        if (platform === 'android') {
          handlerContext.perpsProFontLoadPromise = new Promise(resolve => {
            finishFontLoad = resolve;
          });
        }
      },
    };
    vm.runInNewContext(
      handlerJs + '\nhandleMessage({ detail: { type: "GOT_RUNTIME_INFO" } });',
      handlerContext,
    );
    const expected = resolvePerpsProFontFamily({ platform });
    assert.equal(scene.appliedOptions.length, 1);
    assert.equal(scene.appliedOptions[0].layout.fontFamily, expected);
    assert.equal(scene.overlay.style.fontFamily, expected);
    if (finishFontLoad) {
      finishFontLoad();
      await handlerContext.perpsProFontLoadPromise;
      assert.equal(scene.appliedOptions.length, 2);
      assert.equal(scene.appliedOptions[1].layout.fontFamily, expected);
    }
  }
});

// Execute production render/helpers; only DOM and chart coordinates are faked.
function scene(
  style,
  marketY,
  selectedPrice,
  dark = false,
  viewport,
  overlayPrices = {},
) {
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
  const candles = (viewport?.closes ?? [selectedPrice ?? 100, 110]).map(
    (close, i) => ({
      time: 60 * (i + 1),
      open: 100,
      high: 125,
      low: 90,
      close,
    }),
  );
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
  const range = viewport?.range ?? { from: 0, to: 1 };
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
      ...overlayPrices,
    },
    chart: {
      timeScale: () => ({
        getVisibleLogicalRange: () => range,
        width: () => 340,
        timeToCoordinate: time => (viewport ? viewport.x[time / 60 - 1] : 120),
        coordinateToLogical: () => viewport?.candidate ?? 1,
      }),
      panes: () => [{ getHeight: () => 274 }],
    },
    activeSeries: () => ({
      priceToCoordinate: price => price - 110 + marketY,
      coordinateToPrice: y => y + 110 - marketY,
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
    ...logic,
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
  return { labels, guides };
}

for (const [kind, priceKey, textKey] of [
  ['liquidation', 'liquidationPrice', 'liquidationPriceText'],
  ['entry', 'entryPrice', 'entryPriceText'],
])
  test(`${kind} uses the shared position text while keeping the raw line coordinate and other labels`, () => {
    const raw = 110.4565;
    const baseline = scene('candle', 120, null, false, undefined, {
      [priceKey]: raw,
    });
    for (const text of ['110', '110.45', '110.457', '1,000']) {
      const { labels, guides } = scene('candle', 120, null, false, undefined, {
        [priceKey]: raw,
        [textKey]: text,
      });
      assert.equal(
        labels.find(n => n.dataset.priceKind === kind).textContent,
        text,
      );
      assert.deepEqual(
        guides.map(n => n.children[0].attributes.d),
        baseline.guides.map(n => n.children[0].attributes.d),
      );
      assert.deepEqual(
        labels
          .filter(n => n.dataset.priceKind !== kind)
          .map(n => n.textContent),
        baseline.labels
          .filter(n => n.dataset.priceKind !== kind)
          .map(n => n.textContent),
      );
    }
    assert.equal(
      baseline.labels.find(n => n.dataset.priceKind === kind).textContent,
      String(raw),
    );
  });

test('latest stays horizontal and held prices overlay ordinary labels without shifting them', () => {
  for (const style of ['candle', 'area'])
    for (const dark of [false, true])
      for (const marketY of [0, 110, 274]) {
        const { labels: ordinary } = scene(style, marketY, null, dark);
        // A distinct price within half a pixel must not consume the latest line.
        const { labels: held } = scene(
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

test('Area history badge follows the clipped segment until the latest point enters the pane', () => {
  for (const style of ['area', 'candle'])
    for (const dark of [false, true])
      for (const [to, x, candidate, expected] of [
        [1, [324, 334, 344], 2, 106],
        [0.99, [324.1, 334.1, 344.1], 2, 105.9],
        [0.4, [330, 340, 350], 1, 100],
        [1.9, [315, 325, 335], 2, null],
        [1.4, [320, 330, 340], 2, null],
      ]) {
        const { labels, guides } = scene(style, 110, null, dark, {
          closes: [90, 100, 110],
          range: { from: -10, to },
          x,
          candidate,
        });
        const badge = labels.find(n => n.dataset.priceKind === 'viewport');
        const guide = guides.find(n => n.dataset.priceKind === 'viewport');
        if (style === 'candle' || expected === null) {
          assert.equal(badge, undefined);
          assert.equal(guide, undefined);
        } else {
          assert.ok(badge);
          assert.ok(Math.abs(Number(badge.textContent) - expected) < 1e-9);
          assert.equal(badge.style.boxShadow, 'inset 0 0 0 1px #23C0B0');
          const priceY = Number(
            guide.children[0].attributes.d.match(/^M 0 (\S+)/)[1],
          );
          assert.ok(Math.abs(priceY - expected) < 1e-9);
        }
      }
});
