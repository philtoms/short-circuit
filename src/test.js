const esmRequire = require('esm')(module);

const circuitState = esmRequire('./index.js').default;

describe('circuit-state', () => {
  let element;
  let handlers = {};
  beforeEach(() => {
    element = {
      querySelectorAll: jest.fn(
        (selector) =>
          ({
            x: [element],
            x2: [element, element],
          }[selector] || [])
      ),
      addEventListener: jest.fn((listener, handler) => {
        handlers[listener] = handler;
      }),
    };
  });
  it('should create a circuit', () => {
    expect(circuitState({ x: jest.fn() }, element)({ x: 123 }).x).toBeDefined();
  });
  it('should create a deep circuit', () => {
    expect(
      circuitState(
        { x: { y: { z: jest.fn() } } },
        element
      )({ x: { y: { z: 123 } } }).x.y.z
    ).toBeDefined();
  });
  it('should access mountpoint element', () => {
    circuitState({ x: jest.fn() }, element)({ x: 123 });
    expect(element.querySelectorAll).toHaveBeenCalledWith('x');
  });
  it('should expose signal reducer', () => {
    const x = jest.fn();
    circuitState({ x }, element)({ x: 123 }).x(456);
    expect(x).toHaveBeenCalledWith({ x: 123 }, 456);
  });
  it('should only reduce changed state', () => {
    const x = jest.fn((state, value) => ({ ...state, x: value }));
    const circuit = circuitState({ x }, element)({ x: 123 });
    circuit.x(456);
    circuit.x(456);
    expect(x).toHaveBeenCalledTimes(1);
  });
  it('should reduce all signals', () => {
    const x = (state, value) => ({ ...state, x: value });
    const y = (state, value) => ({ ...state, y: value });
    const circus = circuitState({ x, y }, element)({ x: 123 });
    circus.x(456);
    circus.y(456);
    expect(circus.state()).toEqual({
      x: 456,
      y: 456,
    });
  });
  it('should reduce a deep circuit', () => {
    const y = (state, value) => ({ ...state, y: value });
    expect(
      circuitState({ x: { y } }, element)({ x: { y: 123 } }).x.y(456)
    ).toEqual({ x: { y: 456 } });
  });
  it('should bind a signal to the DOM', () => {
    const y = function () {
      return this;
    };
    const circuit = circuitState({ x: { onclick: y } }, element)({});
    handlers.click.call(element, { target: element });
    expect(circuit.state()).toEqual({
      x: element,
    });
  });
  it('should preserver current state', () => {
    const y = function (state, { target }) {
      return { ...state, value: target };
    };
    const circuit = circuitState(
      { x: { onclick: y } },
      element
    )({ x: { y: 123 } });
    handlers.click.call(element, { target: element });
    expect(circuit.state()).toEqual({
      x: {
        value: element,
        y: 123,
      },
    });
  });
  it('should bind a signal to multiple DOM elements', () => {
    const y = function () {
      return this;
    };
    circuitState({ x2: { onclick: y } }, element)({});
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
      { x: { onclick1: y1, onclick2: y2 } },
      element
    )({});
    handlers.click1.call(element, { target: element });
    expect(circuit.state()).toEqual({
      x: element,
    });
    handlers.click2.call(element, { target: element });
    expect(circuit.state()).toEqual({
      x: element,
    });
  });
});
