const esmRequire = require('esm')(module);

const { default: shortCircuit, _CURRENT } = esmRequire('./index.js');

describe('short-circuit', () => {
  describe('initialisation', () => {
    it('should create a circuit', () => {
      expect(shortCircuit({ id: jest.fn() })({ id: 123 }).id).toBeDefined();
    });
    it('should create a deep circuit', () => {
      expect(
        shortCircuit({ id: { class: { class: jest.fn() } } })({
          id: { class: { class: 123 } },
        }).id.class.class
      ).toBeDefined();
    });
    it('should allow aliased signals in a deep circuit', () => {
      expect(
        'Z' in
          shortCircuit({ 'X:id': { 'Y:class': { 'Z:class': jest.fn() } } })({})
            .id.class
      ).toBe(true);
    });
    it('should allow whitespace in signal', () => {
      expect('X' in shortCircuit({ 'X:id class @event': jest.fn() })({})).toBe(
        true
      );
    });
    it('should strip invalid property chars', () => {
      expect(shortCircuit({ 'id.class[x&="^123"]': jest.fn() })({}).idclassx123)
        .toBeDefined;
    });
    it('should provide read access to circuit state', () => {
      const circuit = shortCircuit({
        X: { Y: { Z: jest.fn() } },
      })({ X: { Y: { Z: 123 } } });
      expect(circuit.state).toEqual({ X: { Y: { Z: 123 } } });
    });
  });

  describe('reducer', () => {
    it('should expose signal reducer', () => {
      const x = jest.fn((state, value) => ({ ...state, id: value }));
      shortCircuit({ id: x })({ id: 123 }).id(456);
      expect(x).toHaveBeenCalledWith({ id: 123 }, 456);
    });
    it('should reduce all signals', () => {
      const x = (state, value) => ({ ...state, x: value });
      const y = (state, value) => ({ ...state, y: value });
      const circut = shortCircuit({ x, y })({ x: 123, y: 123 });
      circut.x(456);
      circut.y(456);
      expect(circut.state).toEqual({
        x: 456,
        y: 456,
      });
    });
    it('should reduce a deep circuit', () => {
      const y = (state, value) => ({ ...state, y: value });
      const circuit = shortCircuit({ id: { x: { y } } })({});
      circuit.id.x.y(456);
      expect(circuit.state).toEqual({ id: { x: { y: 456 } } });
    });
  });

  describe('state change', () => {
    it('should merge @init into original state', () => {
      const originalState = {
        id: 1,
      };
      const circuit = shortCircuit({
        id: { '@init': (state) => state + 1 },
      })(originalState);
      expect(circuit.state).toBe(originalState);
      expect(circuit.state).toEqual({ id: 2 });
    });
    it('should jump state', () => {
      const y1 = (state) => ({ ...state, y1: 456 });
      const y2 = (state) => ({ ...state, y2: 456 });
      const circuit = shortCircuit({ x: { y1, y2 } })({
        x: { y1: 123, y2: 123 },
      });
      circuit.x.y1(_CURRENT);
      circuit.x.y2(_CURRENT);
      expect(circuit.state).toEqual({ x: { y1: 456, y2: 456 } });
    });
    it('should merge state in jump order', () => {
      let orderId = 0;
      const y1 = () => {
        circuit.x.y2(456);
        return { ...circuit.state.x, y1: ++orderId };
      };
      const y2 = (state) => ({ ...state, y2: ++orderId });
      const circuit = shortCircuit({ x: { y1, y2 } })({
        x: { y1: 123, y2: 123 },
      });
      circuit.x.y1(456);
      expect(circuit.state).toEqual({ x: { y1: 2, y2: 1 } });
    });
  });

  describe('propagation', () => {
    it('should propagate through to deferred state', () => {
      const s1 = function (state, value) {
        return { ...state, s1: value };
      };
      const s2 = function (state, value) {
        return { ...state, s2: value };
      };
      const circuit = shortCircuit({ x: { y: { z: { s1 } } }, 'd@/x': { s2 } })(
        {}
      );
      circuit.x.y.z.s1(456);
      expect(circuit.state.d.s2).toEqual({ y: { z: { s1: 456 } } });
    });
    it('should propagate through to terminal', () => {
      const s1 = function (state) {
        return { ...state, s1: 1 };
      };
      const s2 = function (state) {
        return { ...state, s2: 2 };
      };
      const terminal = jest.fn((state) => state);
      const circuit = shortCircuit(
        { x: { y: { z: { s1 } } }, 'd@/x': { s2 } },
        terminal
      )({});
      circuit.x.y.z.s1(456);
      expect(terminal).toHaveBeenCalledWith({ d: { s2: 2 } }, '/d/s2');
      expect(terminal).toHaveBeenCalledWith(circuit.state, '/x/y/z/s1');
    });
    it('should only propagate changed state', () => {
      const x = (state, value) => ({ ...state, id: value });
      const terminal = jest.fn((state) => state);
      const circuit = shortCircuit({ id: x }, terminal)({ id: 123 });
      circuit.id(456);
      circuit.id(456);
      expect(terminal).toHaveBeenCalledTimes(1);
    });
    it('should halt propagation', () => {
      const initState = { id: 123 };
      const terminal = jest.fn((state) => state);
      const x = function () {
        return;
      };
      const circuit = shortCircuit({ id: x })(initState);
      circuit.id(456);
      expect(terminal).not.toHaveBeenCalled();
      expect(circuit.state).toBe(initState);
    });
    it('should propagate @state', () => {
      const circuit = shortCircuit({
        id: {
          x: (s, x) => ({ ...s, x }),
          '@state': (state, value) => ({ ...value, x: 3 }),
        },
      })({});
      circuit.id.x(2);
      expect(circuit.state).toEqual({ id: { x: 3 } });
    });
  });
});

describe('README examples', () => {
  it('counter example', () => {
    const circuit = shortCircuit({
      'add:count': ({ count }, value) => ({ count: count + value }),
    })({
      count: 1,
    });
    circuit.add(1);
    expect(circuit.state.count).toEqual(2);
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
        'counts@/items': {
          total,
          done,
        },
      },
    };
    let todo;
    beforeEach(() => {
      nextId = 0;
      todo = shortCircuit(blueprint)({ items: [], footer: { counts: {} } });
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
