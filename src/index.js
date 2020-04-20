const circuitState = (circuit, node, parent) => (state) => {
  const reducers = [];
  const propagate = function (value, signal) {
    state = reducers.reduce(
      (acc, [address, reducer]) =>
        address in state && value[address] === state[address]
          ? acc
          : address === signal
          ? value
          : address in value
          ? reducer.call(this, acc, value[address])
          : acc,
      state
    );

    return parent ? parent(state) : state;
  };

  return Object.entries(circuit).reduce((acc, [signal, reducer]) => {
    const { selector, event, alias } = signal.match(
      /(?<selector>[^$^@]+)(\s?@?(?<event>\w+))?\s?\$?(?<alias>\w+)?/
    ).groups;

    // normalise the signal address for state
    const address =
      alias || (selector.startsWith('on') ? selector.slice(2) : selector);

    const elements = selector.startsWith('on')
      ? node
      : []
          .concat(node || document)
          .reduce(
            (acc, node) => [
              ...acc,
              ...Array.from(node.querySelectorAll(selector)),
            ],
            []
          );

    const children =
      typeof reducer !== 'function' &&
      circuitState(reducer, elements, (value) =>
        propagate({ ...state, [address]: value }, address)
      )(state[address] || {});

    reducers.push([address, children ? parent : reducer]);

    const handler = function (value) {
      return value === state[address]
        ? value
        : propagate.call(
            this,
            children ? value : reducer.call(this, state, value),
            address
          );
    };

    // bind elements or document events to handler
    if (event || selector.startsWith('on')) {
      const listener = (event || selector)
        .replace(/(on)?(.+)/, '$2')
        .toLowerCase();
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
