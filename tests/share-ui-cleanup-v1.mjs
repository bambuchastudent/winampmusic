import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const index = fs.readFileSync('index.html', 'utf8');
const actions = fs.readFileSync('fast-actions-v143.js', 'utf8');
const cleanup = fs.readFileSync('share-ui-cleanup-v162.js', 'utf8');
const qr = fs.readFileSync('qr-share-v1.js', 'utf8');
const unified = fs.readFileSync('unified-entry-v152.js', 'utf8');

const libraryHeader = index.match(/<div class="library-header"[\s\S]*?<\/div>\s*<input id="search"/)?.[0] || '';
assert.ok(libraryHeader, 'library header must remain present');
assert.ok(!libraryHeader.includes('PLAYLIST'), 'redundant PLAYLIST eyebrow must be removed');
assert.ok(!libraryHeader.includes('Your library'), 'redundant Your library heading must be removed');
assert.match(libraryHeader, /id="trackCount"/, 'compact track count must remain visible');

assert.match(actions, /shareButton\.textContent = 'Share'/);
assert.ok(!actions.includes("shareButton.textContent = 'Share / QR'"));
assert.ok(!actions.includes('openAmpulaButton'));
assert.ok(!actions.includes('Open .ampula'));
assert.match(actions, /share-ui-cleanup-v162\.js\?v=162/);

assert.match(cleanup, /winampShareHeading/);
assert.match(cleanup, /Share music/);
assert.match(cleanup, /Listen to this playlist/);
assert.match(cleanup, /winampShareFile/);
assert.match(cleanup, /\.remove\(\)/, 'format-specific share actions must be removed from rendered UI');
assert.match(cleanup, /Add to library/);
assert.match(cleanup, /findReceivedNotice/);
assert.match(cleanup, /node\.children\.length !== 0/);
assert.match(cleanup, /Opening this link does not change your library/);

assert.ok(!qr.includes('SCAN ÁMPULA'), 'QR panel copy must stay transport-neutral');
assert.match(qr, /SCAN TO OPEN/);
assert.ok(!unified.includes("share.textContent = 'Share / QR'"));

class FakeElement {
  constructor(tagName, { id = '', text = '' } = {}) {
    this.tagName = String(tagName || '').toUpperCase();
    this.id = id;
    this._text = text;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.hidden = false;
  }

  append(...nodes) {
    for (const node of nodes) {
      if (!node) continue;
      node.parentElement = this;
      this.children.push(node);
    }
  }

  get textContent() {
    return [this._text, ...this.children.map((child) => child.textContent)].filter(Boolean).join(' ');
  }

  set textContent(value) {
    this._text = String(value ?? '');
    for (const child of this.children) child.parentElement = null;
    this.children = [];
  }

  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  querySelectorAll(selector) {
    const result = [];
    for (const child of this.children) {
      if (child.matches(selector)) result.push(child);
      result.push(...child.querySelectorAll(selector));
    }
    return result;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  cloneNode() {
    const clone = new FakeElement(this.tagName, { id: this.id, text: this._text });
    clone.hidden = this.hidden;
    return clone;
  }

  addEventListener() {}
  replaceWith(node) {
    if (!this.parentElement) return;
    const parent = this.parentElement;
    const index = parent.children.indexOf(this);
    if (index < 0) return;
    node.parentElement = parent;
    parent.children[index] = node;
    this.parentElement = null;
  }
}

const body = new FakeElement('body');
const dialog = new FakeElement('dialog', { id: 'ampulaReceivedDialog' });
const content = new FakeElement('div');
const header = new FakeElement('div');
const titleBox = new FakeElement('div');
const eyebrow = new FakeElement('div', { text: 'RECEIVED ÁMPULA' });
const title = new FakeElement('strong', { id: 'ampulaReceivedTitle', text: 'Musical moment' });
const close = new FakeElement('button', { id: 'ampulaReceivedClose', text: '✕' });
const player = new FakeElement('div', { id: 'ampulaReceivedPlayer' });
const list = new FakeElement('ol', { id: 'ampulaReceivedList' });
const actionsRow = new FakeElement('div');
const save = new FakeElement('button', { id: 'ampulaSave', text: 'Save Ámpula' });
const add = new FakeElement('button', { id: 'ampulaAdd', text: 'Add playable tracks' });
const file = new FakeElement('button', { id: 'ampulaFile', text: '.ampula file' });
const notice = new FakeElement('div', { text: 'Opening this Ámpula does not change Your library. Playback matches are local and do not rewrite the received object.' });

titleBox.append(eyebrow, title);
header.append(titleBox, close);
actionsRow.append(save, add, file);
content.append(header, player, list, actionsRow, notice);
dialog.append(content);
body.append(dialog);

const document = {
  body,
  querySelector: (selector) => body.querySelector(selector),
  getElementById: (id) => body.querySelector(`#${id}`),
};

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
}

vm.runInNewContext(cleanup, {
  window: {},
  document,
  navigator: {},
  MutationObserver: FakeMutationObserver,
  Element: FakeElement,
  queueMicrotask: (fn) => fn(),
  console: { info() {}, warn() {} },
});

assert.equal(title.textContent, 'Shared music', 'received title must be normalized');
assert.equal(save.textContent, 'Save', 'Save action must survive copy cleanup');
assert.equal(add.textContent, 'Add to library', 'Add action must survive copy cleanup');
assert.equal(notice.textContent, 'Opening this link does not change your library.', 'only the leaf notice should be rewritten');
assert.equal(dialog.querySelector('#ampulaReceivedList'), list, 'track list must survive received-dialog cleanup');
assert.equal(dialog.querySelector('#ampulaSave'), save, 'Save button must remain attached');
assert.equal(dialog.querySelector('#ampulaAdd'), add, 'Add button must remain attached');
assert.equal(dialog.querySelector('#ampulaFile'), null, 'format-specific file action should be removed without deleting siblings');

console.log('compact library and non-destructive Share UI contract passed');
process.exit(0);
