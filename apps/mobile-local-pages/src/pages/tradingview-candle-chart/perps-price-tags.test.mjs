import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPerpsPriceTags } from './perps-price-tags.ts';

function element(name, document) {
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
    append(...children) {
      this.children.push(...children);
    },
    appendChild(child) {
      this.children.push(child);
    },
    getBoundingClientRect() {
      return { width: name === 'overlay' ? 381 : 44 };
    },
  };
}

test('Pro tags stay below the opaque MA band and keep price order', () => {
  const document = {
    createElement: name => element(name, document),
    createElementNS: (_namespace, name) => element(name, document),
  };
  const overlay = element('overlay', document);
  const tag = (id, price, title) => ({
    id,
    price,
    title,
    color: '#000',
    background: '#000',
    text: '#fff',
  });
  renderPerpsPriceTags(overlay, {
    tags: [
      tag('latest', 100),
      tag('tp:130', 130, 'Take profit 100%'),
      tag('sl:95', 95, 'Stop loss 25%'),
    ],
    paneHeight: 200,
    top: 22,
    // y = 150 - price: latest 50, hidden TP 20, SL 55.
    priceToCoordinate: price => 150 - price,
    priceText: String,
    titleOutline: '#fff',
  });

  const labels = overlay.children.filter(n => 'simplePriceLabel' in n.dataset);
  const top = kind =>
    Number.parseFloat(
      labels.find(n => n.dataset.priceKind === kind).style.top,
    ) + 7;
  // A titled guide inside the band is hidden like an off-pane guide.
  assert.deepEqual(
    labels.map(n => n.dataset.priceKind),
    ['latest', 'sl:95'],
  );
  assert.equal(top('latest'), 50);
  // SL sits one 17px label step below the latest badge.
  assert.equal(top('sl:95'), 67);
  const titles = overlay.children.filter(n => 'simplePriceTitle' in n.dataset);
  assert.deepEqual(
    titles.map(n => n.dataset.simplePriceTitle),
    ['sl:95'],
  );
});
