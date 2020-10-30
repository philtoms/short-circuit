const _REDUCERS = Symbol('_REDUCERS');

const fromRoot = (circuit, [head, ...tail]) =>
  tail.length
    ? fromRoot(circuit[head], tail)
    : [(circuit[head] || {})[_REDUCERS] || circuit[_REDUCERS], circuit[head]];

const build = (signals, terminal, _base) => (
  state = {},
  base = () => _base,
  parent = { id: '' },
  reducers = [],
  deferredSignals = [],
  deferredSignal
) => {
  const propagate = (signalState, address, deferred, signal) => {
    // bale until fulfilled
    if (signalState instanceof Promise) {
      signalState.then((s) => {
        return propagate(s, address, false, signal);
      });
      return state;
    }
    // halt propagation when signal is unchanged
    if (address in signalState && signalState[address] === state[address])
      return state;

    // bubble this signal before siblings
    if (terminal) terminal(signalState, signal, deferred);

    // reduce signal state into local circuit state.
    const lastState = state;
    state = signalState;
    return deferred
      ? state
      : reducers.reduce(
          (acc, [key, handler, deferred]) =>
            deferred
              ? handler(acc[address], true) && acc
              : key !== address && acc[key] !== lastState[key]
              ? handler(acc[key])
              : acc,
          state
        );
  };

  const wire = (acc, [signal, reducer, deferredReducers]) => {
    const [, , alias, , _se] = signal.match(/(([\w]+):)?(\s*(.+))?/);
    const [selector, event = ''] = _se.split('$');
    const localCircuit = typeof reducer !== 'function';

    let [resolvedReducers] =
      (event.startsWith('/') && fromRoot(acc, event.slice(1).split('/'))) || [];
    const deferring = !deferredReducers && event.startsWith('/');
    if (deferring) {
      if (localCircuit) {
        resolvedReducers = [];
        deferredSignals.push([signal, reducer, resolvedReducers]);
      }
    } else if (resolvedReducers) {
      deferredReducers.forEach(([s, r]) => resolvedReducers.push([s, r, true]));
      return acc;
    }

    // normalise the signal address for state
    const address = selector;
    const id = `${parent.id}/${address}`;
    if (typeof state === 'object' && !(address in state))
      state[address] = localCircuit ? {} : undefined;

    // a signal can be handled directly or passed through to a child circuit
    const children =
      localCircuit &&
      build(reducer, (value, id, deferred, acc = state) =>
        propagate(
          value ? { ...acc, [address]: value } : acc,
          address,
          deferred,
          id
        )
      )(
        state[address],
        base,
        { id, state, address },
        resolvedReducers || [],
        deferredSignals,
        deferring
      );

    const self = {
      id,
      signal: (id, value) => fromRoot(base(), id.slice(1).split('/'))[1](value),
    };

    if (event === 'init') {
      const iState = reducer.call(
        self,
        address ? state : parent.state || state
      );
      if (!address) {
        state = iState;
        if (terminal) terminal(undefined, id, true, state);
        return acc;
      }
      state[address] = iState[address];
    }

    const handler = function (value, deferred, acc = state) {
      if (typeof value === 'undefined') value = acc[address];
      propagate(
        children
          ? { ...acc, [address]: value }
          : reducer.call(self, acc, value) || state,
        address,
        deferred || deferredSignal,
        id
      );
      return state;
    };

    if (!event || deferring) reducers.push([address, handler, deferring]);

    Object.entries(children || {}).forEach(
      ([key, value]) => (handler[key] = value)
    );
    handler.children = !!children;
    acc[alias || address] = handler;
    return acc;
  };

  const circuit = Object.entries(signals).reduce(wire, {
    [_REDUCERS]: reducers,
  });

  return (_base = parent.id
    ? circuit
    : Object.defineProperty(deferredSignals.reduce(wire, circuit), 'state', {
        get() {
          return state;
        },
      }));
};

export default build;
