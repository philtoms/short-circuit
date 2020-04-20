const DOMcircuit = (circuit, node, parent) => (state) => {
  const reducers = [];
  const propagate = function (signalState, signal) {
    state =
      // halt propogation when signal is empty
      signalState === undefined
        ? state
        : // reduce signal state into circuit state.
          reducers.reduce(
            (acc, [address, reducer]) =>
              // signal identity check to filter signalled state change
              address in state && signalState[address] === state[address]
                ? acc
                : address === signal
                ? signalState
                : address in signalState
                ? reducer.call(this, acc, signalState[address])
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

    // query on parent node(s) unless selector is event
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

    // a signal can be handled directly or passed through to a child circuit
    const children =
      typeof reducer !== 'function' &&
      DOMcircuit(reducer, elements, (value) =>
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

    // bind element events to handler. Handler context (this) will be element
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

export default DOMcircuit;
