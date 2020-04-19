'use strict';
const circuitState = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('./index.js'));

describe('circuit-state', () => {
  it('should create a circuit', () => {
    expect(circuitState({ x: jest.fn() })).toEqual('');
  });
});
