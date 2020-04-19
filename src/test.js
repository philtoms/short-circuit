const esmRequire = require('esm')(module);

const element = {
  querySelectorAll: jest.fn(() => [element]),
  addEventListener: jest.fn((listener, handler) => {
    debugger;
    handler.call(element, 456);
  }),
};

const circuitState = esmRequire('./index.js').default;

describe('circuit-state', () => {
  it('should create a circuit', () => {
    expect(circuitState({ x: jest.fn() }, element)({ x: 123 }).x).toBeDefined();
  });
  it('should create a deep circuit', () => {
    expect(
      circuitState({ x: { y: jest.fn() } }, element)({ x: { y: 123 } }).x.y
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
    debugger;
    const circuit = circuitState({ x: { onclick: y } }, element)({});
    expect(element.addEventListener).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );
    expect(circuit.state()).toEqual({
      x: element,
    });
  });
});
