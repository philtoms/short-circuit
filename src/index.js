const _REDUCERS = Symbol('_REDUCERS');
const _ID = Symbol('_ID');
const fromRoot = (circuit, [head, ...tail]) =>
  tail.length
    ? fromRoot(circuit[head], tail)
    : typeof circuit[head] === 'object'
    ? [circuit[head][_REDUCERS], false]
    : [circuit[_REDUCERS], _ID];

export const _CURRENT = Symbol();

const shortCircuit = (circuit, terminal) => (
  state = {},
  parent = { id: '' },
  reducers = [],
  deferredSignals = [],
  deferredSignal
) => {
  const propagate = (signalState, signal, deferred, id) => {
    // halt propagation when signal is empty or unchanged
    if (
      !signalState ||
      (signal in signalState && signalState[signal] === state[signal])
    )
      return state;
    if (deferred === _ID) return signalState;

    const lastState = state;
    const nextState = deferred
      ? signalState
      : // reduce signal state into circuit state.
        reducers.reduce((acc, [address, handler, deferred, shared]) => {
          acc = shared
            ? { ...acc, ...handler(acc[signal], _ID) }
            : // deferred children handle their own state chains and will
            // always be propagated after local state has been reduced
            deferred
            ? handler(deferred === _ID ? acc[signal] : acc) && state
            : address in signalState
            ? signalState[address] === acc[address]
              ? acc
              : address === signal
              ? { ...acc, [address]: signalState[signal] }
              : handler(signalState[address])
            : signalState;
          if (!(acc instanceof Promise)) state = acc;
          return acc;
        }, state);

    // bale until fulfilled
    if (nextState instanceof Promise) {
      nextState.then((s) => {
        return propagate(s, signal, false, id);
      });
      return state;
    }

    state = circuit['@state']
      ? circuit['@state'](lastState, nextState)
      : nextState;

    return terminal ? terminal(state, id) || state : state;
  };

  const build = (acc, [signal, reducer, deferredReducers]) => {
    const [, , alias, , _se] = signal.match(/(([\w]+):)?(\s*(.+))?/);
    const [address, event = ''] = _se.split('@');
    if (event === 'init') {
      state = reducer(state);
      if (parent.state) parent.state[parent.address] = state;
      return acc;
    }

    let [resolvedReducers, deferredId] =
      (event.startsWith('/') && fromRoot(acc, event.slice(1).split('/'))) || [];
    const deferring = !deferredReducers && event.startsWith('/');
    if (deferring) {
      resolvedReducers = [];
      deferredSignals.push([signal, reducer, resolvedReducers]);
    } else if (resolvedReducers) {
      deferredReducers.forEach((reducer) =>
        resolvedReducers.push([
          ...reducer,
          deferredId || true,
          resolvedReducers === reducers,
        ])
      );
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
        resolvedReducers || [],
        deferredSignals,
        deferring
      );

    const handler = function (value, deferredId) {
      if (value === _CURRENT) value = state[address];
      const signal = address || parent.address;
      return propagate(
        children ? value : reducer.call({ signal }, state, value),
        address || parent.address,
        deferredId || deferredSignal,
        id
      );
    };

    ((typeof reducer === 'function' && resolvedReducers) || reducers).push([
      address || parent.address,
      children ? terminal : handler,
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
    : Object.defineProperty(deferredSignals.reduce(build, signals), 'state', {
        get() {
          return state;
        },
      });
};

export default shortCircuit;
