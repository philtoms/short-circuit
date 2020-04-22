const esmRequire = require('esm')(module);

const DOMCircuit = esmRequire('./index.js').default;

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
      expect(DOMCircuit({ '#id': jest.fn() })({ id: 123 }).id).toBeDefined();
    });
    it('should create a deep circuit', () => {
      expect(
        DOMCircuit({ '#id': { '.class': { '.class': jest.fn() } } })({
          id: { class: { class: 123 } },
        }).id.class.class
      ).toBeDefined();
    });
    it('should allow aliased signals in a deep circuit', () => {
      expect(
        DOMCircuit({ 'X:#id': { 'Y:.class': { 'Z:.class': jest.fn() } } })({}).X
          .Y.Z
      ).toBeDefined();
    });
    it('should allow initialised state through aliased signals', () => {
      const circuit = DOMCircuit({
        'X:#id': { 'Y:.class': { 'Z:.class': jest.fn() } },
      })({ X: { Y: { Z: 123 } } });
      expect(circuit.state()).toEqual({ X: { Y: { Z: 123 } } });
    });
    it('should allow whitespace in signal', () => {
      expect(
        DOMCircuit({ 'X:#id .class onevent': jest.fn() })({}).X
      ).toBeDefined();
    });
    it('should strip invalid property chars', () => {
      expect(DOMCircuit({ '#id.class[x&="^123"]': jest.fn() })({}).idclassx123)
        .toBeDefined;
    });
  });

  describe('reducer', () => {
    it('should expose signal reducer', () => {
      const x = jest.fn((state, value) => ({ ...state, '#id': value }));
      DOMCircuit({ '#id': x })({ id: 123 }).id(456);
      expect(x).toHaveBeenCalledWith({ id: 123 }, 456);
    });
    it('should only reduce changed state', () => {
      const x = jest.fn((state, value) => ({ ...state, id: value }));
      const circuit = DOMCircuit({ '#id': x })({ id: 123 });
      circuit.id(456);
      circuit.id(456);
      expect(x).toHaveBeenCalledTimes(1);
    });
    it('should reduce all signals', () => {
      const x = (state, value) => ({ ...state, id: value });
      const y = (state, value) => ({ ...state, class: value });
      const circus = DOMCircuit({ '#id': x, y })({ id: 123 });
      circus.id(456);
      circus.y(456);
      expect(circus.state()).toEqual({
        id: 456,
        class: 456,
      });
    });
    it('should reduce a deep circuit', () => {
      const y = (state, value) => ({ ...state, class: value });
      expect(
        DOMCircuit({ '#id': { y } }, element)({ id: { class: 123 } }).id.y(456)
      ).toEqual({ id: { class: 456 } });
    });
  });

  describe('binding', () => {
    it('should access mountpoint element', () => {
      DOMCircuit({ '#id': jest.fn() }, element)({ '#id': 123 });
      expect(element.querySelectorAll).toHaveBeenCalledWith('#id');
    });
    it('should bind a signal to a DOM element', () => {
      const y = function () {
        return this;
      };
      const circuit = DOMCircuit({ '#id.onclick': y }, element)({});
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual(element);
    });
    it('should bind an alias to a DOM element', () => {
      const y = function (state, { target }) {
        return target;
      };
      const circuit = DOMCircuit({ 'XXX:#id.onclick': y }, element)({});
      circuit.XXX({ target: element });
      expect(circuit.state()).toEqual(element);
    });
    it('should bind a signal to a parent DOM element', () => {
      const y = function () {
        return this;
      };
      const circuit = DOMCircuit({ '#id': { onclick: y } }, element)({});
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual({
        id: element,
      });
    });
    it('should bind a signal to multiple DOM elements', () => {
      const y = function () {
        return this;
      };
      DOMCircuit({ '.class': { onclick: y } }, element)({});
      expect(element.addEventListener).toHaveBeenCalledTimes(2);
    });
    it('should bind multiple signals to a single DOM', () => {
      const y1 = function () {
        return this;
      };
      const y2 = function () {
        return this;
      };
      const circuit = DOMCircuit(
        { '#id': { onclick1: y1, onclick2: y2 } },
        element
      )({});
      handlers.click1.call(element, { target: element });
      expect(circuit.state()).toEqual({
        id: element,
      });
      handlers.click2.call(element, { target: element });
      expect(circuit.state()).toEqual({
        id: element,
      });
    });
  });

  describe('state change', () => {
    it('should manipulate current state', () => {
      const y = function (state, { target }) {
        return target;
      };
      const circuit = DOMCircuit(
        { '#id': { onclick: y } },
        element
      )({ id: { class: 123 } });
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual({
        id: element,
      });
    });
    it('should preserve current state', () => {
      const y = function (state, { target }) {
        return { ...state, target };
      };
      const circuit = DOMCircuit(
        { '#id': { onclick: y } },
        element
      )({ id: { class: 123 } });
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual({
        id: {
          target: element,
          class: 123,
        },
      });
    });
    it('should propagate sibling state', () => {
      const y1 = function (state, value) {
        return { ...state, y2: value };
      };
      const y2 = jest.fn();
      DOMCircuit(
        { '#id': { y1, y2 } },
        element
      )({ id: { y1: 123, y2: 123 } }).id.y1(456);
      expect(y2).toHaveBeenCalledWith({ y1: 123, y2: 123 }, 456);
    });
    it('should halt propagation', () => {
      const initState = { id: { class: 123 } };
      const y = function () {
        return;
      };
      const circuit = DOMCircuit({ '#id': { onclick: y } }, element)(initState);
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual(initState);
    });
    it('should jump state', () => {
      const y1 = (state, value) => {
        circuit.x.y2(value);
      };
      const y2 = (state, value) => ({ ...state, y2: value });
      const circuit = DOMCircuit(
        { 'x:#id': { y1, y2 } },
        element
      )({ x: { y1: 123, y2: 123 } });
      circuit.x.y1(456);
      expect(circuit.state()).toEqual({ x: { y1: 123, y2: 456 } });
    });
    it('should merge jump state', () => {
      const y1 = (state, value) => {
        return { ...state, y1: value, y2: circuit.x.y2(456).x.y2 };
      };
      const y2 = (state, value) => ({ ...state, y2: value });
      const circuit = DOMCircuit(
        { 'x:#id': { y1, y2 } },
        element
      )({ x: { y1: 123, y2: 123 } });
      circuit.x.y1(456);
      expect(circuit.state()).toEqual({ x: { y1: 456, y2: 456 } });
    });
  });
});

describe('README examples', () => {
  it('counter example', () => {
    const circuit = DOMCircuit({
      counter: ({ counter }, value) => ({ counter: counter + value }),
    })({
      counter: 1,
    });
    expect(circuit.counter(4)).toEqual({ counter: 5 });
  });

  describe('todos', () => {
    let nextId;
    const update = (todos, item) => [
      ...remove(todos, item),
      { ...item, id: item.id || ++nextId },
    ];
    const remove = (todos, { id }) => todos.filter((todo) => todo.id !== id);
    const total = ({ todos }) => todos.length;
    const done = ({ todos }) =>
      todos.reduce((count, { done }) => (count + done ? 1 : 0), 0);

    const blueprint = {
      header: {
        add: (state, value) => app.todos.update(value),
      },
      '#todos': {
        update,
        remove,
      },
      footer: {
        'counts:#todos.onchange': {
          total,
          done,
        },
      },
    };
    let app;
    beforeEach(() => {
      nextId = 0;
      app = DOMCircuit(
        blueprint,
        element
      )({ todos: [], footer: { counts: {} } });
    });

    it('should add an item', () => {
      app.header.add({ text: 'todo 1' });
      expect(app.state().todos).toEqual([{ id: 1, text: 'todo 1' }]);
    });
    it('should update an item', () => {
      app.header.add({ text: 'todo 1' });
      app.todos.update({ text: 'todo 1 updated', id: 1 });
      expect(app.state().todos).toEqual([{ id: 1, text: 'todo 1 updated' }]);
    });
    it('should remove an item', () => {
      app.header.add({ text: 'todo 1' });
      app.todos.remove({ id: 1 });
      expect(app.state().todos).toEqual([]);
    });
    it('should update counts', () => {
      app.header.add({ text: 'todo 1' });
      handlers.change({ counts: 'x' });
      expect(app.state().footer.counts).toEqual({ total: 1, done: 0 });
    });
  });
});
