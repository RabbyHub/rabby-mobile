import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendSimplePriceGuide,
  simplePriceGuidePath,
} from './perps-simple-price-guide.ts';

const segments = path =>
  [...path.matchAll(/([MHC])\s+([^MHC]+)/g)].map(([, command, values]) => ({
    command,
    values: values.trim().split(/\s+/).map(Number),
  }));

test('displaced titles replace the old straight extension in a single continuous guide', () => {
  const path = simplePriceGuidePath({
    priceY: 101,
    labelX: 300,
    labelY: 117,
    title: { right: 52, bottom: 120 },
  });
  const parts = segments(path);
  assert.deepEqual(
    parts.map(part => part.command),
    ['M', 'C', 'H', 'C'],
  );
  assert.deepEqual(parts[0].values, [52, 120]);
  assert.equal(parts[1].values.at(-1), 101);
  assert.equal(parts[3].values[1], 101);
  assert.deepEqual(parts[3].values.slice(-2), [300, 117]);
  assert.ok(!path.includes('M 0 '));
});

test('straight and right-only guides preserve the true price and do not restart dashes', () => {
  assert.equal(
    simplePriceGuidePath({ priceY: 100, labelX: 300, labelY: 100 }),
    'M 0 100 H 300',
  );
  const parts = segments(
    simplePriceGuidePath({ priceY: 100, labelX: 300, labelY: 70 }),
  );
  assert.deepEqual(
    parts.map(part => part.command),
    ['M', 'H', 'C'],
  );
  assert.deepEqual(parts[0].values, [0, 100]);
  assert.equal(parts[2].values[1], 100);
  assert.deepEqual(parts[2].values.slice(-2), [300, 70]);
});

test('both curves remain monotonic and tangent to their endpoints on narrow plots', () => {
  for (const width of [1, 8, 24, 50, 300]) {
    for (const leftOffset of [-100, -20, -0.1, 0.1, 20, 100]) {
      for (const rightOffset of [-100, -20, -0.1, 0, 0.1, 20, 100]) {
        const parts = segments(
          simplePriceGuidePath({
            priceY: 120,
            labelX: 52 + width,
            labelY: 120 + rightOffset,
            title: { right: 52, bottom: 120 + leftOffset },
          }),
        );
        let [x, y] = parts[0].values;
        for (const part of parts.slice(1)) {
          if (part.command === 'H') {
            assert.equal(y, 120);
            assert.ok(part.values[0] >= x);
            x = part.values[0];
          } else {
            const [c1x, c1y, c2x, c2y, endX, endY] = part.values;
            assert.ok(x <= c1x && c1x <= c2x && c2x <= endX);
            assert.ok(endX - x <= 32 + 1e-10);
            assert.equal(c1y, y);
            assert.equal(c2y, endY);
            [x, y] = [endX, endY];
          }
        }
        assert.equal(x, 52 + width);
        assert.equal(y, 120 + rightOffset);
      }
    }
  }
  assert.equal(
    simplePriceGuidePath({
      priceY: 100,
      labelX: 50,
      labelY: 120,
      title: { right: 52, bottom: 80 },
    }),
    '',
  );
});

test('the renderer emits one dashed path for every guide, without solid connector nodes', () => {
  // Record the DOM boundary while executing the production SVG renderer.
  const document = {
    createElementNS(namespace, name) {
      assert.equal(namespace, 'http://www.w3.org/2000/svg');
      return {
        name,
        attributes: {},
        setAttribute(key, value) {
          this.attributes[key] = value;
        },
      };
    },
  };
  for (const dash of ['4 2', '1 1']) {
    const svg = {
      ownerDocument: document,
      children: [],
      appendChild(child) {
        this.children.push(child);
      },
    };
    const path = appendSimplePriceGuide(
      svg,
      {
        priceY: 101,
        labelX: 300,
        labelY: 117,
        title: { right: 52, bottom: 120 },
      },
      '#36B16D',
      dash,
    );
    assert.deepEqual(svg.children, [path]);
    assert.equal(path.name, 'path');
    assert.equal(path.attributes['stroke-dasharray'], dash);
    assert.equal(path.attributes.fill, 'none');
    assert.equal(path.attributes['stroke-width'], '1');
    assert.equal(path.attributes.d.match(/M/g).length, 1);
    assert.equal(path.attributes.d.match(/C/g).length, 2);
  }
});
