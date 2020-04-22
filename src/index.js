const DOMcircuit = (blueprint, element = [], parent) => (state) => {
  const reducers = [];
  const propagate = function (signalState, signal) {
    state =
      // halt propagation when signal is empty
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

  const circuit = Object.entries(blueprint).reduce((acc, [signal, reducer]) => {
    const { alias, domSelector } = signal.match(
      /((?<alias>[\w]+):)?(\s*(?<domSelector>.+))?/
    ).groups;
    const [selector, event] = domSelector.split(/[\s\.]on/);

    // normalise the signal address for state
    const address =
      alias ||
      (selector.startsWith('on') ? selector.slice(2) : selector).replace(
        /[#\.\-\[\]\(\)\"\=\^\&]/g,
        ''
      );

    // optionally query on parent element(s) unless selector is event
    const elements = selector.startsWith('on')
      ? element
      : []
          .concat(element)
          .reduce(
            (acc, element) => [
              ...acc,
              ...Array.from(element.querySelectorAll(selector)),
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

    return Object.defineProperty(acc, address, {
      get() {
        return children || state[address];
      },
      set(value) {
        return handler(value)[address];
      },
    });
  }, {});
  return Object.defineProperty(circuit, 'state', {
    get() {
      return state;
    },
  });
};

export default DOMcircuit;
