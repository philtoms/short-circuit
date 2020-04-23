const _REDUCERS = Symbol();
const fromRoot = (circuit, [head, ...tail]) =>
  tail.length
    ? fromRoot(circuit[head], tail)
    : circuit[head] && circuit[head][_REDUCERS];

const DOMcircuit = (blueprint, element = [], parent) => (
  state,
  level = 1,
  reducers = [],
  deferred = [],
  deferredChild
) => {
  const propagate = function (signalState, signal, deferred) {
    deferred
      ? parent((state = signalState))
      : (state =
          // halt propagation when signal is empty
          signalState === undefined
            ? state
            : // reduce signal state into circuit state.
              reducers.reduce(
                (acc, [address, reducer, deferred]) =>
                  // deferred children handle their own state chains and will always
                  // be propagated after local state has reduced
                  deferred
                    ? reducer.call(this, acc) || acc
                    : // signal identity check to filter signalled state change
                    address in state && signalState[address] === state[address]
                    ? acc
                    : address === signal
                    ? signalState
                    : address in signalState
                    ? reducer.call(this, acc, signalState[address])
                    : acc,
                state
              ));

    return parent ? parent(state) : state;
  };

  const build = (acc, [signal, reducer, deferredReducers]) => {
    const [_0, _1, alias, _3, _se] = signal.match(/(([\w]+):)?(\s*(.+))?/);
    const [selector, event] = _se.split(/[\s\.]on/);

    // normalise the signal address for state
    const address =
      alias ||
      (selector.startsWith('on') ? selector.slice(2) : selector).replace(
        /[#\.\-\[\]\(\)\"\=\^\&\/]/g,
        ''
      );

    let deferReducers =
      selector.startsWith('/') && fromRoot(acc, selector.slice(1).split('/'));
    const deferring = !deferredReducers && selector.startsWith('/');
    if (deferring) {
      deferReducers = [];
      deferred.push([signal, reducer, deferReducers]);
    } else if (deferReducers) {
      deferredReducers.forEach((reducer) => deferReducers.push(reducer));
      return acc;
    }
    // optionally query on parent element(s) unless selector is event
    const elements = selector.startsWith('on')
      ? element
      : []
          .concat(element)
          .reduce(
            (circuit, element) => [
              ...circuit,
              ...Array.from(element.querySelectorAll(selector)),
            ],
            []
          );

    // a signal can be handled directly or passed through to a child circuit
    const children =
      typeof reducer !== 'function' &&
      DOMcircuit(reducer, elements, (value) =>
        propagate({ ...state, [address]: value }, address)
      )(
        state[address] || {},
        level + 1,
        deferReducers || [],
        deferred,
        deferring
      );

    reducers.push([
      address,
      deferredChild
        ? function (value) {
            handler.call(this, value, true);
          }
        : children
        ? parent
        : reducer,
      deferredChild,
    ]);

    const handler = function (value, deferred) {
      return value === state[address]
        ? value
        : propagate.call(
            this,
            children ? value : reducer.call(this, state, value),
            address,
            deferred
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
  };

  const circuit = Object.entries(blueprint).reduce(build, {
    [_REDUCERS]: reducers,
  });

  return Object.defineProperty(
    level == 1 ? deferred.reduce(build, circuit) : circuit,
    'state',
    {
      get() {
        return state;
      },
    }
  );
};

export default DOMcircuit;
