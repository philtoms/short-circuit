const _REDUCERS = Symbol();
const fromRoot = (circuit, [head, ...tail]) =>
  tail.length
    ? fromRoot(circuit[head], tail)
    : circuit[head] && circuit[head][_REDUCERS];

export const _CURRENT = Symbol();

const shortCircuit = (blueprint, terminal) => (
  state = {},
  stateId = '',
  parentState,
  parentAddress,
  reducers = [],
  deferred = [],
  deferredChild
) => {
  const propagate = function (signalState, signal, deferred, id) {
    // halt propagation when signal is empty or unchanged
    if (
      signalState === undefined ||
      (signal in state && signalState[signal] === state[signal])
    )
      return state;
    deferred
      ? terminal((state = signalState), id)
      : (state =
          // reduce signal state into circuit state.
          reducers.reduce(
            (acc, [address, reducer, deferred]) =>
              // deferred children handle their own state chains and will always
              // be propagated after local state has reduced
              deferred
                ? reducer.call(this, acc) && acc
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

    state = blueprint['@state']
      ? blueprint['@state'](state, signalState)
      : state;
    return terminal ? terminal(state, id) : state;
  };

  const build = (acc, [signal, reducer, deferredReducers]) => {
    const [, , alias, , _se] = signal.match(/(([\w]+):)?(\s*(.+))?/);
    const [address, event = ''] = _se.split('@');
    if (event === 'init') {
      state = reducer(state);
      parentState[parentAddress] = state;
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

    const id = `${stateId}/${address}`;

    // a signal can be handled directly or passed through to a child circuit
    const children =
      typeof reducer !== 'function' &&
      shortCircuit(reducer, (value, id) =>
        propagate({ ...state, [address]: value }, address, false, id)
      )(
        state[address],
        id,
        state,
        address,
        deferReducers || [],
        deferred,
        deferring
      );

    function handler(value) {
      return propagate.call(
        this,
        children
          ? value
          : reducer.call(
              this,
              state,
              value === _CURRENT ? state[address] : value
            ),
        address,
        deferredChild,
        id
      );
    }

    reducers.push([address, children ? terminal : handler, deferredChild]);

    acc[alias || address] = (value) => handler(value)[address];
    return children
      ? Object.defineProperty(acc, address, {
          get() {
            return children;
          },
        })
      : acc;
  };

  const circuit = Object.entries(blueprint).reduce(build, {
    [_REDUCERS]: reducers,
  });

  return stateId
    ? circuit
    : Object.defineProperty(deferred.reduce(build, circuit), 'state', {
        get() {
          return state;
        },
      });
};

export default shortCircuit;
