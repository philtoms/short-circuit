const esmRequire = require('esm')(module);

const DOMcircuit = esmRequire('./index.js').default;

let element;
let handlers;
beforeEach(() => {
  handlers = {};
  element = {
    querySelectorAll: jest.fn(
      (selector) =>
        ({
          '#id': [element],
          '.class': [element, element],
        }[selector] || [element])
    ),
    addEventListener: jest.fn((listener, handler) => {
      handlers[listener] = handler;
    }),
  };
});
describe('dom-circuit', () => {
  describe('initialisation', () => {
    it('should create a circuit', () => {
      expect(DOMcircuit({ '#id': jest.fn() })({ id: 123 }).id).toBeDefined();
    });
    it('should create a deep circuit', () => {
      expect(
        DOMcircuit({ '#id': { '.class': { '.class': jest.fn() } } })({
          id: { class: { class: 123 } },
        }).id.class.class
      ).toBeDefined();
    });
    it('should allow aliased signals in a deep circuit', () => {
      expect(
        'Z' in
          DOMcircuit({ 'X:#id': { 'Y:.class': { 'Z:.class': jest.fn() } } })({})
            .X.Y
      ).toBe(true);
    });
    it('should allow whitespace in signal', () => {
      expect(
        'X' in DOMcircuit({ 'X:#id .class //onevent': jest.fn() })({})
      ).toBe(true);
    });
    it('should strip invalid property chars', () => {
      expect(DOMcircuit({ '#id.class[x&="^123"]': jest.fn() })({}).idclassx123)
        .toBeDefined;
    });
    it('should provide read access to circuit state', () => {
      const circuit = DOMcircuit({
        'X:#id': { 'Y:.class': { 'Z:.class': jest.fn() } },
      })({ X: { Y: { Z: 123 } } });
      expect(circuit.state).toEqual({ X: { Y: { Z: 123 } } });
    });
    it('should provide read access to circuit signal state', () => {
      const signal = DOMcircuit({ '#id': jest.fn() })({ id: 123 }).id;
      expect(signal).toBe(123);
    });
    it('should provide read access to nested signal state', () => {
      const signal = DOMcircuit({ '#id': { x: jest.fn() } })({ id: { x: 123 } })
        .id.x;
      expect(signal).toBe(123);
    });
    it('should provide read access to nested circuit signal state', () => {
      const signal = DOMcircuit({ '#id': { x: jest.fn() } })({ id: { x: 123 } })
        .id;
      expect(signal.state).toEqual({ x: 123 });
    });
  });

  describe('reducer', () => {
    it('should expose signal reducer', () => {
      const x = jest.fn((state, value) => ({ ...state, '#id': value }));
      DOMcircuit({ '#id': x })({ id: 123 }).id = 456;
      expect(x).toHaveBeenCalledWith({ id: 123 }, 456);
    });
    it('should only reduce changed state', () => {
      const x = jest.fn((state, value) => ({ ...state, id: value }));
      const circuit = DOMcircuit({ '#id': x })({ id: 123 });
      circuit.id = 456;
      circuit.id = 456;
      expect(x).toHaveBeenCalledTimes(1);
    });
    it('should reduce all signals', () => {
      const x = (state, value) => ({ ...state, x: value });
      const y = (state, value) => ({ ...state, y: value });
      const circut = DOMcircuit({ x, y })({ x: 123, y: 123 });
      circut.x = 456;
      circut.y = 456;
      expect(circut.state).toEqual({
        x: 456,
        y: 456,
      });
    });
    it('should reduce a deep circuit', () => {
      const y = (state, value) => ({ ...state, y: value });
      const circuit = DOMcircuit({ '#id': { x: { y } } }, element)({});
      circuit.id.x.y = 456;
      expect(circuit.state).toEqual({ id: { x: { y: 456 } } });
    });
  });

  describe('binding', () => {
    it('should access mountpoint element', () => {
      DOMcircuit({ '#id': jest.fn() }, element)({ '#id': 123 });
      expect(element.querySelectorAll).toHaveBeenCalledWith('#id');
    });
    it('should bind a signal to a DOM element', () => {
      const y = function () {
        return this;
      };
      const circuit = DOMcircuit({ '#id//onclick': y }, element)({});
      handlers.click.call(element, { target: element });
      expect(circuit.state).toEqual(element);
    });
    it('should bind an alias to a DOM element', () => {
      const y = function (state, { target }) {
        return target;
      };
      const circuit = DOMcircuit({ 'XXX:#id//onclick': y }, element)({});
      circuit.XXX = { target: element };
      expect(circuit.state).toEqual(element);
    });
    it('should bind a signal to a parent DOM element', () => {
      const y = function () {
        return this;
      };
      const circuit = DOMcircuit({ '#id': { '//onclick': y } }, element)({});
      handlers.click.call(element, { target: element });
      expect(circuit.state).toEqual({
        id: element,
      });
    });
    it('should bind a signal to multiple DOM elements', () => {
      const y = function () {
        return this;
      };
      DOMcircuit({ '.class': { '//onclick': y } }, element)({});
      expect(element.addEventListener).toHaveBeenCalledTimes(2);
    });
    it('should bind multiple signals to a single DOM', () => {
      const y1 = function () {
        return this;
      };
      const y2 = function () {
        return this;
      };
      const circuit = DOMcircuit(
        { '#id': { '//onclick1': y1, '//onclick2': y2 } },
        element
      )({});
      handlers.click1.call(element, { target: element });
      expect(circuit.state).toEqual({
        id: element,
      });
      handlers.click2.call(element, { target: element });
      expect(circuit.state).toEqual({
        id: element,
      });
    });
  });

  describe('state change', () => {
    it('should manipulate current state', () => {
      const y = function (state, { target }) {
        return target;
      };
      const circuit = DOMcircuit(
        { '#id': { '//onclick': y } },
        element
      )({ id: { class: 123 } });
      handlers.click.call(element, { target: element });
      expect(circuit.state).toEqual({
        id: element,
      });
    });
    it('should preserve current state', () => {
      const y = function (state, { target }) {
        return { ...state, target };
      };
      const circuit = DOMcircuit(
        { '#id': { '//onclick': y } },
        element
      )({ id: { class: 123 } });
      handlers.click.call(element, { target: element });
      expect(circuit.state).toEqual({
        id: {
          target: element,
          class: 123,
        },
      });
    });
    it('should jump state', () => {
      const y1 = (state, value) => {
        circuit.x.y2 = value;
      };
      const y2 = (state, value) => ({ ...state, y2: value });
      const circuit = DOMcircuit(
        { 'x:#id': { y1, y2 } },
        element
      )({ x: { y1: 123, y2: 123 } });
      circuit.x.y1 = 456;
      expect(circuit.state).toEqual({ x: { y1: 123, y2: 456 } });
    });
    it('should merge jump state', () => {
      const y1 = (state, value) => {
        return { ...state, y1: value, y2: (circuit.x.y2 = 456) };
      };
      const y2 = (state, value) => ({ ...state, y2: value });
      const circuit = DOMcircuit(
        { 'x:#id': { y1, y2 } },
        element
      )({ x: { y1: 123, y2: 123 } });
      circuit.x.y1 = 456;
      expect(circuit.state).toEqual({ x: { y1: 456, y2: 456 } });
    });
  });

  describe('propagation', () => {
    it('should propagate sibling state', () => {
      const y1 = function (state, value) {
        return { ...state, y2: value };
      };
      const y2 = jest.fn();
      DOMcircuit(
        { '#id': { y1, y2 } },
        element
      )({ id: { y1: 123, y2: 123 } }).id.y1 = 456;
      expect(y2).toHaveBeenCalledWith({ y1: 123, y2: 123 }, 456);
    });
    it('should halt propagation', () => {
      const initState = { id: { class: 123 } };
      const y = function () {
        return;
      };
      const circuit = DOMcircuit(
        { '#id': { '//onclick': y } },
        element
      )(initState);
      handlers.click.call(element, { target: element });
      expect(circuit.state).toBe(initState);
    });
    it('should propagate through to deferred state', () => {
      const s1 = function (state, value) {
        return { ...state, s1: value };
      };
      const s2 = function (state, value) {
        return { ...state, s2: value };
      };
      const circuit = DOMcircuit(
        { x: { y: { z: { s1 } } }, 'd//x': { s2 } },
        element
      )({});
      circuit.x.y.z.s1 = 456;
      expect(circuit.state.d.s2).toEqual({ y: { z: { s1: 456 } } });
    });
  });
});

describe('README examples', () => {
  it('counter example', () => {
    const circuit = DOMcircuit({
      counter: ({ counter }, value) => ({ counter: counter + value }),
    })({
      counter: 1,
    });
    circuit.counter = 4;
    expect(circuit.state).toEqual({ counter: 5 });
  });

  describe('todos', () => {
    let nextId;
    const update = (todos, item) => [
      ...remove(todos, item),
      { ...item, id: item.id || ++nextId },
    ];
    const remove = (todos, { id }) => todos.filter((todo) => todo.id !== id);
    const total = (state, todos) => ({ ...state, total: todos.length });
    const done = (state, todos) => ({
      ...state,
      done: todos.reduce((count, { done }) => count + (done ? 1 : 0), 0),
    });

    const blueprint = {
      header: {
        add: (state, value) => (app.todos.update = value),
      },
      '#todos': {
        update,
        remove,
      },
      footer: {
        'counts//todos': {
          total,
          done,
        },
      },
    };
    let app;
    beforeEach(() => {
      nextId = 0;
      app = DOMcircuit(
        blueprint,
        element
      )({ todos: [], footer: { counts: {} } });
    });

    it('should add an item', () => {
      app.header.add = { text: 'todo 1' };
      expect(app.state.todos).toEqual([{ id: 1, text: 'todo 1' }]);
    });
    it('should update an item', () => {
      app.header.add = { text: 'todo 1' };
      app.todos.update = { text: 'todo 1 updated', id: 1 };
      expect(app.state.todos).toEqual([{ id: 1, text: 'todo 1 updated' }]);
    });
    it('should remove an item', () => {
      app.header.add = { text: 'todo 1' };
      app.todos.remove = { id: 1 };
      expect(app.state.todos).toEqual([]);
    });
    it('should update counts', () => {
      app.header.add = { text: 'todo 1' };
      app.header.add = { text: 'todo 2' };
      app.todos.update = { text: 'todo 2 done', id: 2, done: true };
      expect(app.state.footer.counts).toEqual({ total: 2, done: 1 });
    });
  });
});
