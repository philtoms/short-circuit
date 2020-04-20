const esmRequire = require('esm')(module);

const circuitState = esmRequire('./index.js').default;

describe('circuit-state', () => {
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
          }[selector] || [])
      ),
      addEventListener: jest.fn((listener, handler) => {
        handlers[listener] = handler;
      }),
    };
  });

  describe('initialisation', () => {
    it('should create a circuit', () => {
      expect(
        circuitState({ '#id': jest.fn() }, element)({ '#id': 123 })['#id']
      ).toBeDefined();
    });
    it('should create a deep circuit', () => {
      expect(
        circuitState(
          { '#id': { '.class': { '.class': jest.fn() } } },
          element
        )({ '#id': { '.class': { '.class': 123 } } })['#id']['.class']['.class']
      ).toBeDefined();
    });
    it('should allow aliased signals in a deep circuit', () => {
      expect(
        circuitState(
          { '#id$X': { '.class$Y': { '.class$Z': jest.fn() } } },
          element
        )({}).X.Y.Z
      ).toBeDefined();
    });
    it('should allow initialised state through aliased signals', () => {
      const circuit = circuitState(
        { '#id$X': { '.class$Y': { '.class$Z': jest.fn() } } },
        element
      )({ X: { Y: { Z: 123 } } });
      expect(circuit.state()).toEqual({ X: { Y: { Z: 123 } } });
    });
    it('should allow whitespace in signal', () => {
      expect(
        circuitState({ '#id .class @event $ALIAS': jest.fn() }, element)({})
          .ALIAS
      ).toBeDefined();
    });
  });

  describe('reducer', () => {
    it('should expose signal reducer', () => {
      const x = jest.fn((state, value) => ({ ...state, '#id': value }));
      circuitState({ '#id': x }, element)({ '#id': 123 })['#id'](456);
      expect(x).toHaveBeenCalledWith({ '#id': 123 }, 456);
    });
    it('should only reduce changed state', () => {
      const x = jest.fn((state, value) => ({ ...state, '#id': value }));
      const circuit = circuitState({ '#id': x }, element)({ '#id': 123 });
      circuit['#id'](456);
      circuit['#id'](456);
      expect(x).toHaveBeenCalledTimes(1);
    });
    it('should reduce all signals', () => {
      const x = (state, value) => ({ ...state, '#id': value });
      const y = (state, value) => ({ ...state, '.class': value });
      const circus = circuitState({ '#id': x, y }, element)({ '#id': 123 });
      circus['#id'](456);
      circus.y(456);
      expect(circus.state()).toEqual({
        '#id': 456,
        '.class': 456,
      });
    });
    it('should reduce a deep circuit', () => {
      const y = (state, value) => ({ ...state, '.class': value });
      expect(
        circuitState(
          { '#id': { y } },
          element
        )({ '#id': { '.class': 123 } })['#id'].y(456)
      ).toEqual({ '#id': { '.class': 456 } });
    });
  });

  describe('binding', () => {
    it('should access mountpoint element', () => {
      circuitState({ '#id': jest.fn() }, element)({ '#id': 123 });
      expect(element.querySelectorAll).toHaveBeenCalledWith('#id');
    });
    it('should bind a signal to a DOM element', () => {
      const y = function () {
        return this;
      };
      const circuit = circuitState({ '#id@click': y }, element)({});
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual(element);
    });
    it('should bind an alias to a DOM element', () => {
      const y = function (state, { target }) {
        return target;
      };
      const circuit = circuitState({ '#id@click$XXX': y }, element)({});
      circuit.XXX({ target: element });
      expect(circuit.state()).toEqual(element);
    });
    it('should bind a signal to a parent DOM element', () => {
      const y = function () {
        return this;
      };
      const circuit = circuitState({ '#id': { onclick: y } }, element)({});
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual({
        '#id': element,
      });
    });
    it('should bind a signal to multiple DOM elements', () => {
      const y = function () {
        return this;
      };
      circuitState({ '.class': { onclick: y } }, element)({});
      expect(element.addEventListener).toHaveBeenCalledTimes(2);
    });
    it('should bind multiple signals to a single DOM', () => {
      const y1 = function () {
        return this;
      };
      const y2 = function () {
        return this;
      };
      const circuit = circuitState(
        { '#id': { onclick1: y1, onclick2: y2 } },
        element
      )({});
      handlers.click1.call(element, { target: element });
      expect(circuit.state()).toEqual({
        '#id': element,
      });
      handlers.click2.call(element, { target: element });
      expect(circuit.state()).toEqual({
        '#id': element,
      });
    });
  });

  describe('state change', () => {
    it('should manipulate current state', () => {
      const y = function (state, { target }) {
        return target;
      };
      const circuit = circuitState(
        { '#id': { onclick: y } },
        element
      )({ '#id': { '.class': 123 } });
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual({
        '#id': element,
      });
    });
    it('should preserve current state', () => {
      const y = function (state, { target }) {
        return { ...state, target };
      };
      const circuit = circuitState(
        { '#id': { onclick: y } },
        element
      )({ '#id': { '.class': 123 } });
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual({
        '#id': {
          target: element,
          '.class': 123,
        },
      });
    });
    it('should propagate sibling state', () => {
      const y1 = function (state, value) {
        return { ...state, y2: value };
      };
      const y2 = jest.fn();
      circuitState(
        { '#id': { y1, y2 } },
        element
      )({ '#id': { y1: 123, y2: 123 } })['#id'].y1(456);
      expect(y2).toHaveBeenCalledWith({ y1: 123, y2: 123 }, 456);
    });
    it('should halt propagation', () => {
      const initState = { '#id': { '.class': 123 } };
      const y = function () {
        return;
      };
      const circuit = circuitState(
        { '#id': { onclick: y } },
        element
      )(initState);
      handlers.click.call(element, { target: element });
      expect(circuit.state()).toEqual(initState);
    });
    it('should jump state', () => {
      const y1 = (state, value) => {
        circuit.x.y2(value);
      };
      const y2 = (state, value) => ({ ...state, y2: value });
      const circuit = circuitState(
        { '#id $x': { y1, y2 } },
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
      const circuit = circuitState(
        { '#id $x': { y1, y2 } },
        element
      )({ x: { y1: 123, y2: 123 } });
      circuit.x.y1(456);
      expect(circuit.state()).toEqual({ x: { y1: 456, y2: 456 } });
    });
  });

  describe('README examples', () => {
    it('counter example', () => {
      const circuit = circuitState(
        {
          counter: ({ counter }, value) => ({ counter: counter + value }),
        },
        element
      )({
        counter: 1,
      });
      expect(circuit.counter(4)).toEqual({ counter: 5 });
    });
  });
});
