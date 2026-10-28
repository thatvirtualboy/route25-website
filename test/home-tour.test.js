const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A deterministic clock exercises the public controls without real-time sleeps.
function setup(reducedMotion = false) {
  class Element {
    constructor() {
      this.events = {};
      this.attrs = {};
      this.dataset = {};
      this.hidden = false;
      this.style = { setProperty() {} };
      this.classList = { remove() {}, contains() { return false; } };
    }
    addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
    emit(name, event = {}) { for (const fn of this.events[name] || []) fn(event); }
    setAttribute(name, value) { this.attrs[name] = value; }
    getAttribute(name) { return this.attrs[name]; }
    contains(target) { return target === this; }
    focus() { tour.emit('focusin', { target: this }); }
    querySelectorAll() { return []; }
  }
  const nav = new Element();
  const toggle = new Element();
  const tour = new Element();
  const playback = new Element();
  const panels = new Element();
  const slides = Array.from({ length: 4 }, (_, i) => Object.assign(new Element(), { hidden: i !== 0 }));
  const tabs = slides.map((_, i) => {
    const tab = new Element();
    tab.attrs['aria-controls'] = String(i);
    tab.attrs['aria-selected'] = String(i === 0);
    return tab;
  });
  const motion = Object.assign(new Element(), { matches: reducedMotion });
  const document = Object.assign(new Element(), { hidden: false });
  document.querySelector = selector => ({ '[data-nav-toggle]': toggle, '#site-nav': nav, '[data-feature-tour]': tour })[selector] || null;
  document.getElementById = id => slides[Number(id)];
  tour.querySelectorAll = () => tabs;
  tour.querySelector = selector => ({ '.feature-panels': panels, '[data-tour-toggle]': playback })[selector] || new Element();
  const frames = new Map();
  let id = 0;
  let time = 0;
  let observe;
  const window = {
    addEventListener() {},
    matchMedia: () => motion,
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/home.js'), 'utf8'), {
    window, document, Date,
    IntersectionObserver: class { constructor(callback) { observe = callback; } observe() {} }
  });
  return {
    tabs, tour, playback, panels, document, motion,
    visible(value) { observe([{ isIntersecting: value, intersectionRatio: value ? 1 : 0 }]); },
    advance(ms) {
      // Run the first frame, then the elapsed interval.
      for (const step of [0, ms]) {
        time += step;
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(fn => fn(time));
      }
    },
    selected() { return tabs.findIndex(tab => tab.attrs['aria-selected'] === 'true'); },
    shown() { return slides.filter(slide => !slide.hidden).length; }
  };
}

test('tour waits until visible, advances every eight seconds, and wraps', () => {
  const page = setup();
  page.advance(16000);
  assert.equal(page.selected(), 0);
  page.visible(true);
  page.advance(7999);
  assert.equal(page.selected(), 0);
  page.advance(1);
  assert.equal(page.selected(), 1);
  for (let i = 0; i < 3; i++) page.advance(8000);
  assert.equal(page.selected(), 0);
  assert.equal(page.shown(), 1);
});

test('manual selection stays put until Play; Pause holds the current feature', () => {
  const page = setup();
  page.visible(true);
  page.tabs[2].emit('click');
  page.advance(30000);
  assert.equal(page.selected(), 2);
  assert.equal(page.playback.attrs['aria-label'], 'Play feature tour');
  page.playback.emit('click');
  page.advance(8000);
  assert.equal(page.selected(), 3);
  page.playback.emit('click');
  page.advance(16000);
  assert.equal(page.selected(), 3);
});

test('offscreen and background-tab pauses retain elapsed time', () => {
  const page = setup();
  page.visible(true);
  page.advance(4000);
  page.visible(false);
  page.advance(20000);
  page.visible(true);
  page.document.hidden = true;
  page.document.emit('visibilitychange');
  page.advance(20000);
  assert.equal(page.selected(), 0);
  page.document.hidden = false;
  page.document.emit('visibilitychange');
  page.advance(4000);
  assert.equal(page.selected(), 1);
});

test('keyboard navigation stops the timer and maintains a single selected tab', () => {
  const page = setup();
  page.visible(true);
  page.tabs[0].emit('keydown', { key: 'End', preventDefault() {} });
  page.advance(16000);
  assert.equal(page.selected(), 3);
  assert.equal(page.shown(), 1);
  assert.equal(page.tabs.filter(tab => tab.tabIndex === 0).length, 1);
  page.tabs[3].emit('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(page.selected(), 0);
});

test('reduced motion starts paused and enabling it stops an active tour', () => {
  const page = setup(true);
  page.visible(true);
  page.advance(16000);
  assert.equal(page.selected(), 0);
  assert.equal(page.playback.attrs['aria-label'], 'Play feature tour');
  page.playback.emit('click');
  page.advance(8000);
  assert.equal(page.selected(), 1);
  page.motion.emit('change');
  page.advance(16000);
  assert.equal(page.selected(), 1);
});


test('hovering does not interrupt automatic rotation', () => {
  const page = setup();
  page.visible(true);
  page.panels.emit('pointerenter', { pointerType: 'mouse' });
  page.advance(8000);
  assert.equal(page.selected(), 1);
  page.advance(8000);
  assert.equal(page.selected(), 2);
  assert.equal(page.playback.attrs['aria-label'], 'Pause feature tour');
});
