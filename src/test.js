const esmRequire = require('esm')(module);

const { default: circuit, _CURRENT } = esmRequire('./index.js');

describe('circuit', () => {
  describe('initialisation', () => {
    it('should create a circuit', () => {
      expect(circuit({ id: jest.fn() })({ id: 123 }).id).toBeDefined();
    });
    it('should create a deep circuit', () => {
      expect(
        circuit({ id: { class: { class: jest.fn() } } })({
          id: { class: { class: 123 } },
        }).id.class.class
      ).toBeDefined();
    });
    it('should allow aliased signals in a deep circuit', () => {
      expect(
        'Z' in
          circuit({ 'X:id': { 'Y:class': { 'Z:class': jest.fn() } } })({}).id
            .class
      ).toBe(true);
    });
    it('should allow whitespace in signal', () => {
      expect('X' in circuit({ 'X:id class $event': jest.fn() })({})).toBe(true);
    });
    it('should provide read access to cct state', () => {
      const cct = circuit({
        X: { Y: { Z: jest.fn() } },
      })({ X: { Y: { Z: 123 } } });
      expect(cct.state).toEqual({ X: { Y: { Z: 123 } } });
    });
  });

  describe('reducer', () => {
    it('should expose signal reducer', () => {
      const x = jest.fn((state, value) => ({ ...state, id: value }));
      circuit({ id: x })({ id: 123 }).id(456);
      expect(x).toHaveBeenCalledWith({ id: 123 }, 456);
    });
    it('should reduce all signals', () => {
      const x = (state, value) => ({ ...state, x: value });
      const y = (state, value) => ({ ...state, y: value });
      const circut = circuit({ x, y })({ x: 123, y: 123 });
      circut.x(456);
      circut.y(456);
      expect(circut.state).toEqual({
        x: 456,
        y: 456,
      });
    });
    it('should reduce a deep circuit', () => {
      const y = (state, value) => ({ ...state, y: value });
      const cct = circuit({ id: { x: { y } } })({});
      cct.id.x.y(456);
      expect(cct.state).toEqual({ id: { x: { y: 456 } } });
    });
    it('should expose signal to reducer', () => {
      let signal;
      const y = function () {
        signal = this.signal;
      };
      const cct = circuit({ id: y })({});
      cct.id();
      expect(signal).toBe('/id');
    });
    it('should expose base state to reducer', () => {
      let state;
      const z = function () {
        state = this.state;
      };
      circuit({ x: { y: { z } } })({ a: 123 }).x.y.z();
      expect(state).toEqual({ a: 123 });
    });
    it('should expose base signals to reducer', () => {
      const z = function (state, value) {
        this.a.b.c(value);
      };
      const c = jest.fn();
      circuit({ x: { y: { z } }, a: { b: { c } } })({}).x.y.z(123);
      expect(c).toHaveBeenCalledWith({}, 123);
    });
  });

  describe('state change', () => {
    it('should jump state', () => {
      const y1 = (state) => ({ ...state, y1: 456 });
      const y2 = (state) => ({ ...state, y2: 456 });
      const cct = circuit({ x: { y1, y2 } })({
        x: { y1: 123, y2: 123 },
      });
      cct.x.y1(_CURRENT);
      cct.x.y2(_CURRENT);
      expect(cct.state).toEqual({ x: { y1: 456, y2: 456 } });
    });
    it('should merge state in jump order', () => {
      let orderId = 0;
      const y1 = () => {
        cct.x.y2(456);
        return { ...cct.state.x, y1: ++orderId };
      };
      const y2 = (state) => ({ ...state, y2: ++orderId });
      const cct = circuit({ x: { y1, y2 } })({
        x: { y1: 123, y2: 123 },
      });
      cct.x.y1(456);
      expect(cct.state).toEqual({ x: { y1: 2, y2: 1 } });
    });
  });
  describe('propagation', () => {
    it('should propagate through sibling state', () => {
      const x = (state, value) => ({ ...state, x: value + 1 });
      const y = () => ({ x: 1, y: 1 });
      const cct = circuit({ x, y })({});
      cct.y();
      expect(cct.state).toEqual({ x: 2, y: 1 });
    });
    it('should not propagate unchanged sibling state', () => {
      const x = (state, value) => ({ ...state, x: value + 1 });
      const y = () => ({ x: 1, y: 1 });
      const cct = circuit({ x, y })({ x: 1 });
      cct.y();
      expect(cct.state).toEqual({ x: 1, y: 1 });
    });
    it('should not propagate through sibling event', () => {
      const x = (state, value) => ({ ...state, x: value + 1 });
      const y = () => ({ x: 1, y: 1 });
      const cct = circuit({ x$state: x, y })();
      cct.y();
      expect(cct.state).toEqual({ y: 1 });
    });
    it('should propagate to deferred state', () => {
      const s1 = function (state, value) {
        return { ...state, x: value };
      };
      const s2 = function (state, value) {
        return { ...state, d: value };
      };
      const cct = circuit({ x: s1, 'd$/x': s2 })({ x: 1 });
      cct.x(456);
      expect(cct.state.x).toEqual(456);
      expect(cct.state.d).toEqual(456);
    });
    it('should propagate to deferred nested state', () => {
      const s1 = function (state, value) {
        return { ...state, x: value };
      };
      const s2 = function (state, value) {
        return { ...state, d: value };
      };
      const cct = circuit({ x: s1, 'd$/x': { s2 } })({ x: 1 });
      cct.x(456);
      expect(cct.state.x).toEqual(456);
      expect(cct.state.d).toEqual(456);
    });
    it('should propagate nested state to deferred nested state', () => {
      const s1 = function (state, value) {
        return { ...state, s1: value };
      };
      const s2 = function (state, value) {
        return { ...state, s2: value };
      };
      const cct = circuit({ x: { y: { z: { s1 } } }, 'def$/x': { s2 } })({});
      cct.x.y.z.s1(456);
      expect(cct.state.def.s2).toEqual({ y: { z: { s1: 456 } } });
    });
    it('should propagate nested state to deeply deferred nested state', () => {
      const s1 = function (state, value) {
        return { ...state, z: value };
      };
      const s2 = function (state, value) {
        return { ...state, s2: value };
      };
      const cct = circuit({ x: { y: { z: s1 } }, 'd$/x/y/z': { s2 } })({});
      cct.x.y.z(456);
      expect(cct.state.d.s2).toEqual(456);
    });
    it('should propagate through to terminal', () => {
      const s1 = function (state) {
        return { ...state, s1: 1 };
      };
      const s2 = function (state) {
        return { ...state, s2: 2 };
      };
      const terminal = jest.fn((state) => state);
      const cct = circuit(
        { x: { y: { z: { s1 } } }, 'd$/x': { s2 } },
        terminal
      )({});
      cct.x.y.z.s1(456);
      expect(terminal).toHaveBeenCalledWith({ d: { s2: 2 } }, '/d/s2');
      expect(terminal).toHaveBeenCalledWith(cct.state, '/x/y/z/s1');
    });
    it('should only propagate changed state', () => {
      const x = (state, value) => ({ ...state, id: value });
      const terminal = jest.fn((state) => state);
      const cct = circuit({ id: x }, terminal)({ id: 123 });
      cct.id(456);
      cct.id(456);
      expect(terminal).toHaveBeenCalledTimes(1);
    });
    it('should halt propagation', () => {
      const initState = { id: 123 };
      const terminal = jest.fn((state) => state);
      const x = function () {
        return;
      };
      const cct = circuit({ id: x })(initState);
      cct.id(456);
      expect(terminal).not.toHaveBeenCalled();
      expect(cct.state).toBe(initState);
    });
  });
});

describe('events', () => {
  it('should merge $init into original state', () => {
    const originalState = {
      id: 1,
    };
    const cct = circuit({
      id: {
        $init: (state) => state + 1,
      },
    })(originalState);
    expect(cct.state).toBe(originalState);
    expect(cct.state).toEqual({ id: 2 });
  });
  it('should propagate to $state', () => {
    const cct = circuit({
      $state: (state, value) => ({ ...value, y: 3 }),
      id: {
        x: (s, x) => ({ ...s, x }),
      },
    })({});
    cct.id.x(2);
    expect(cct.state).toEqual({ id: { x: 2 }, y: 3 });
  });
});

describe('async', () => {
  it('should resolve at state change', async () => {
    const cct = circuit({
      x: (s, x) => Promise.resolve({ ...s, x: 2 }),
    })({});
    await cct.x();
    expect(cct.state).toEqual({ x: 2 });
  });
  it('should resolve at deep state change', async () => {
    const cct = circuit({
      id: {
        x: (s, x) => Promise.resolve({ ...s, x }),
      },
    })({});
    await cct.id.x(2);
    expect(cct.state).toEqual({ id: { x: 2 } });
  });

  it('should resolve at terminal', async () => {
    const terminal = async (state) => {
      expect(state).toEqual({ id: { x: 2 } });
    };
    const cct = circuit(
      {
        id: {
          x: (s, x) => Promise.resolve({ ...s, x }),
        },
      },
      terminal
    )({});
    await cct.id.x(2);
  });
  it('should resolve sibling state change sequence at terminal', (done) => {
    const terminal = (state, signal) => {
      if (signal === '/id/z') {
        expect(state).toEqual({ id: { x: 1, y: 2, z: 3 } });
        done();
      }
    };
    const cct = circuit(
      {
        id: {
          x: (s, x) => Promise.resolve({ ...s, x, y: 1 }),
          y: (s, y) => Promise.resolve({ ...s, y: y + 1, z: 2 }),
          z: (s, z) => Promise.resolve({ ...s, z: z + 1 }),
        },
      },
      terminal
    )({});
    cct.id.x(1);
  });
});

describe('README examples', () => {
  it('counter example', () => {
    const cct = circuit({
      'add:count': ({ count }, value) => ({ count: count + value }),
    })({
      count: 1,
    });
    cct.add(1);
    expect(cct.state.count).toEqual(2);
  });

  describe('todo', () => {
    let nextId;
    const update = (items, item) => [
      ...remove(items, item),
      { ...item, id: item.id || ++nextId },
    ];
    const remove = (items, { id }) => items.filter((todo) => todo.id !== id);
    const total = (state, items) => ({ ...state, total: items.length });
    const done = (state, items) => ({
      ...state,
      done: items.reduce((count, { done }) => count + (done ? 1 : 0), 0),
    });

    const blueprint = {
      header: {
        add: (state, value) => todo.items.update(value),
      },
      items: {
        update,
        remove,
      },
      footer: {
        'counts$/items': {
          total,
          done,
        },
      },
    };
    let todo;
    beforeEach(() => {
      nextId = 0;
      todo = circuit(blueprint)({ items: [], footer: { counts: {} } });
    });

    it('should add an item', () => {
      todo.header.add({ text: 'todo 1' });
      expect(todo.state.items).toEqual([{ id: 1, text: 'todo 1' }]);
    });
    it('should update an item', () => {
      todo.header.add({ text: 'todo 1' });
      todo.items.update({ text: 'todo 1 updated', id: 1 });
      expect(todo.state.items).toEqual([{ id: 1, text: 'todo 1 updated' }]);
    });
    it('should remove an item', () => {
      todo.header.add({ text: 'todo 1' });
      todo.items.remove({ id: 1 });
      expect(todo.state.items).toEqual([]);
    });
    it('should update counts', () => {
      todo.header.add({ text: 'todo 1' });
      todo.header.add({ text: 'todo 2' });
      todo.items.update({ text: 'todo 2 done', id: 2, done: true });
      expect(todo.state.footer.counts).toEqual({ total: 2, done: 1 });
    });
  });
});
