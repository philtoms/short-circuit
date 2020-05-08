const _REDUCERS = Symbol();
const document = typeof window !== 'undefined' && window.document;
const fromRoot = (circuit, [head, ...tail]) =>
  tail.length
    ? fromRoot(circuit[head], tail)
    : circuit[head] && circuit[head][_REDUCERS];

export const _CURRENT = Symbol();

const lazyQuery = (e, s) =>
  ['.', '#', ''].reduce(
    (acc, q) => (acc.length ? acc : e.querySelectorAll(q + s)),
    []
  );

const DOMcircuit = (blueprint, terminal, element) => (
  state,
  stateId = '',
  reducers = [],
  deferred = [],
  deferredChild
) => {
  if (!element && typeof terminal !== 'function') {
    element = terminal || [];
    terminal = false;
  }
  const propagate = function (signalState, signal, deferred, id) {
    deferred
      ? terminal((state = signalState), id)
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

    return terminal ? terminal(state, id) : state;
  };

  const build = (acc, [signal, reducer, deferredReducers]) => {
    const [_0, _1, alias, _3, _se] = signal.match(/(([\w]+):)?(\s*(.+))?/);
    const [selector, event = ''] = _se.split('@');

    // normalise the signal address for state
    const address =
      (!(selector in state) && alias) ||
      selector.replace(/[#\.\-\[\]\(\)\"\=\^\&]/g, '');

    const id = `${stateId}/${address}`;

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
    // optionally query on parent element(s) unless selector is event
    const elements = !selector
      ? element
      : []
          .concat(element || document)
          .reduce(
            (circuit, element) => [
              ...circuit,
              ...Array.from(lazyQuery(element, selector)),
            ],
            []
          );

    // a signal can be handled directly or passed through to a child circuit
    const children =
      typeof reducer !== 'function' &&
      DOMcircuit(
        reducer,
        (value, id) =>
          propagate({ ...state, [address]: value }, address, false, id),
        elements
      )(state[address] || {}, id, deferReducers || [], deferred, deferring);

    function handler(value) {
      // only propagate changed state
      return value === state[address]
        ? value
        : propagate.call(
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

    // bind element events to handler. Handler context (this) will be element
    if (event && !event.startsWith('/')) {
      elements.forEach((element) => {
        element.addEventListener(event, handler);
      });
    }

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

export default DOMcircuit;
