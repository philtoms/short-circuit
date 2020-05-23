const _REDUCERS = Symbol();
const fromRoot = (circuit, [head, ...tail]) =>
  tail.length
    ? fromRoot(circuit[head], tail)
    : circuit[head] && circuit[head][_REDUCERS];

export const _CURRENT = Symbol();

const shortCircuit = (circuit, terminal) => (
  state = {},
  parent = { id: '' },
  reducers = [],
  deferred = [],
  deferredChild
) => {
  const propagate = (signalState, signal, deferred, id) => {
    // halt propagation when signal is empty or unchanged
    if (
      signalState === undefined ||
      (signal in signalState && signalState[signal] === state[signal])
    )
      return state;

    state = deferred
      ? signalState
      : // reduce signal state into circuit state.
        reducers.reduce(
          (acc, [address, handler, deferred]) =>
            // deferred children handle their own state chains and will always
            // be propagated after local state has been reduced
            deferred
              ? handler(acc) && acc
              : address in signalState
              ? signalState[address] === state[address]
                ? acc
                : address === signal
                ? { ...acc, [address]: signalState[signal] }
                : (signalState = handler(
                    signalState[address],
                    true,
                    signalState
                  ))
              : signalState,
          state
        );

    state = circuit['@state']
      ? circuit['@state'](state, signalState[signal])
      : state;

    return terminal ? terminal(state, id) : state;
  };

  const build = (acc, [signal, reducer, deferredReducers]) => {
    const [, , alias, , _se] = signal.match(/(([\w]+):)?(\s*(.+))?/);
    const [address, event = ''] = _se.split('@');
    if (event === 'init') {
      state = reducer(state);
      if (parent.state) parent.state[parent.address] = state;
      return acc;
    }

    let deferReducers =
      event.startsWith('/') && fromRoot(acc, event.slice(1).split('/'));
    const deferring = !deferredReducers && event.startsWith('/');
    if (deferring) {
      deferReducers = [];
      deferred.push([signal, reducer, deferReducers]);
    } else if (deferReducers) {
      deferredReducers.forEach((reducer) => deferReducers.push(reducer));
      return acc;
    }

    const id = `${parent.id}/${address}`;

    // a signal can be handled directly or passed through to a child circuit
    const children =
      typeof reducer !== 'function' &&
      shortCircuit(reducer, (value, id) =>
        propagate(
          id.endsWith('/') ? value : { ...state, [address]: value },
          address,
          false,
          id
        )
      )(
        typeof state[address] === 'object' ? state[address] : state,
        { id, state, address },
        deferReducers || [],
        deferred,
        deferring
      );

    const handler = function (value, deferred, deferredState = state) {
      if (value === _CURRENT) value = state[address];
      const signal = address || parent.address;
      return propagate(
        children ? value : reducer.call({ signal }, deferredState, value),
        address || parent.address,
        deferredChild || deferred,
        id
      );
    };

    reducers.push([
      address || parent.address,
      children ? terminal : handler,
      deferredChild,
    ]);

    acc[alias || address] = (value) => handler(value)[address];
    return children
      ? Object.defineProperty(acc, address, {
          get() {
            return children;
          },
        })
      : acc;
  };

  const signals = Object.entries(circuit).reduce(build, {
    [_REDUCERS]: reducers,
  });

  return parent.id
    ? signals
    : Object.defineProperty(deferred.reduce(build, signals), 'state', {
        get() {
          return state;
        },
      });
};

export default shortCircuit;
