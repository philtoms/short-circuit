const circuitState = (circuit, node, parent = (v) => v) => (state) => {
  const propagate = function (reducer, value) {
    state = reducer.call(this, state, value);
    return parent(state);
  };

  return Object.entries(circuit).reduce((acc, [signal, reducer]) => {
    const [selector, event = selector, alias] = signal.split(/[@:]/);

    // normalise the signal address for state
    const address =
      alias || (selector.startsWith('on') ? selector.slice(2) : selector);

    const elements = []
      .concat(node || document)
      .reduce(
        (acc, node) => [...acc, ...Array.from(node.querySelectorAll(selector))],
        []
      );

    const children =
      typeof reducer !== 'function' &&
      circuitState(
        reducer,
        elements,
        (value) =>
          (state = {
            ...state,
            [address]: value,
          })
      )(state[address] || {});

    const handler = function (value) {
      return value === state[address]
        ? value
        : propagate.call(this, children ? parent : reducer, value);
    };

    // bind elements or document events to handler
    if (event.startsWith('on') || event !== selector) {
      const listener = event.replace(/(on)?(.+)/, '$2').toLowerCase();
      elements.forEach((element) => {
        element.addEventListener(listener, handler);
      });
    }

    return {
      ...acc,
      [address]: children || handler,
      state: () => state,
    };
  }, {});
};

export default circuitState;
