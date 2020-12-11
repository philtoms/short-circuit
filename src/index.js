const _REDUCERS = Symbol('_REDUCERS');
const _BASE = Symbol('_BASE');
const _PROPAGATE = Symbol('_PROPAGATE');

const fromSignal = (circuit = {}, [head, ...tail]) => {
  if (head === '.') return fromSignal(circuit, tail);
  if (head === '..') return fromSignal(circuit[_BASE], tail);
  return !head
    ? circuit[_BASE]
      ? fromSignal(circuit[_BASE], [head, ...tail])
      : fromSignal(circuit, tail)
    : tail.length
    ? fromSignal(circuit[head], tail)
    : [circuit[_REDUCERS], circuit[head]];
};

const build = (signals, config = {}) => {
  const {
    base,
    junctions,
    parent = { id: '', state: () => state },
    deferredSignals = [],
    handlers = [],
    ctx = {},
    terminal,
  } = config;
  let { state = {} } = config;
  const propagate = (signalState, deferred, address, signal, local) => {
    // bale until fulfilled
    if (signalState instanceof Promise) {
      signalState.then((state) => {
        return propagate(state, false, address, signal, local);
      });
      return state;
    }

    // halt propagation when signal is unchanged
    if (signalState === state) {
      return state;
    }

    // restore undefined state
    if (signalState === undefined) {
      signalState = state;
    }

    // defer bubbling for locally propagated signals
    const bubble = deferred !== handlers;

    if (local)
      state = handlers.reduce(
        (acc, [, handler, deferring]) =>
          (!deferring &&
            handler(signalState[address], handlers, signal, acc)) ||
          acc,
        state
      );
    else {
      state = signalState;
      if (bubble)
        state = handlers.reduce(
          (acc, [key, handler, deferring]) =>
            deferring && key && signal.startsWith(key)
              ? (handler(
                  acc[address] === undefined ? acc : acc[address],
                  handlers,
                  signal
                ),
                state)
              : (!key &&
                  deferred !== 'state' &&
                  handler(undefined, handlers, signal, acc)) ||
                acc,
          state
        );
    }

    const junction =
      !deferred &&
      handlers.find(([key, , , layered]) => key === address && layered);

    if (terminal && bubble)
      terminal(state, signal, !!junction || deferred, !!address);

    if (junction) junction[1](undefined, true, signal, state);

    return state;
  };

  const wire = (acc, [signal, reducer, deferred]) => {
    const [, , alias, , _se, asMap] = signal.match(
      /(([\w]+):)?(\s*([^_]+))?(_)?/
    );
    const [selector, event = ''] = _se.split('$');
    const deferring = /^[\/\.]/.test(event);
    const signals = typeof reducer !== 'function' && reducer;
    const isCircuit =
      signals && Object.keys(signals).some((key) => !key.startsWith('$'));

    if (deferred) {
      const [resolvedReducers] = fromSignal(acc, deferred.split('/'));
      resolvedReducers.push([deferred.replace(/\./g, ''), reducer, handlers]);
      return acc;
    }

    // normalise the signal address for state
    const address = selector.replace(/[#\.\-\[\]\(\)\"\=\^\&]/g, '');
    const id =
      address || event ? `${parent.id}/${address || event}` : parent.id || '/';

    const self = {
      id,
      address,
      signal: (id, value) =>
        fromSignal((id.startsWith('//') && junctions) || acc, id.split('/'))[1](
          value
        ),
    };

    const proxy = new Proxy(self, {
      get: (_, prop) => (prop in ctx ? ctx[prop] : self[prop]),
      set: (_, prop, value) => {
        ctx[prop] = value;
        return true;
      },
    });

    // a signal can be handled directly or passed through to a child circuit
    const children = signals
      ? build(signals, {
          terminal: (value, signal, deferred, prop) =>
            propagate(
              prop ? { ...state, [address]: value } : value,
              deferred,
              address,
              signal || id
            ),
          base: acc,
          junctions,
          state: state[address] || state,
          parent: { id, address, state: () => state, isCircuit },
          deferredSignals,
        })
      : {};

    if (event === 'init') {
      const iState = reducer.call(proxy, address ? state : parent.state());
      if (!address) {
        if (iState !== undefined) {
          state = iState;
          if (terminal) terminal(state, id, 'state');
        }
        return acc;
      }
      if (iState) state[address] = iState[address];
    }

    const mapValue = (key, value) => {
      const newValue = reducer.call(proxy, value);
      return newValue === undefined
        ? undefined
        : newValue === value
        ? state
        : {
            ...state,
            [key]: newValue,
          };
    };

    const handler = function (
      value,
      deferred,
      signal,
      acc = address ? state : parent.state()
    ) {
      const key = address || parent.address;
      if (value === void 0) value = acc[key];
      // circuit handler called for child propagation
      return (signals ? children[_PROPAGATE] : propagate)(
        signals
          ? { ...acc, [key]: value }
          : asMap
          ? mapValue(key, value)
          : reducer.call(proxy, acc, value),
        deferred,
        signals && !isCircuit ? '' : address,
        signal || id,
        isCircuit || (!address && parent.isCircuit && event !== 'state')
      );
    };

    if ((!deferring && !event) || event === 'state') {
      handlers.push([address, handler]);
      const [layer, junction] = fromSignal(junctions, id.split('/'));
      if (typeof junction === 'function') {
        handlers.push([address, junction, layer, true]);
        layer.push([address, handler, handlers, true]);
      }
    }

    if (deferring) {
      deferredSignals.push([signal, handler, event]);
    }

    // transfer local cct to handler
    Object.entries(children).forEach(([key, value]) => (handler[key] = value));
    handler[_REDUCERS] = children[_REDUCERS];
    handler[_BASE] = children[_BASE];

    if (event !== 'state') acc[alias || address || event] = handler;

    return acc;
  };

  const circuit = Object.entries(signals).reduce(wire, {
    [_REDUCERS]: handlers,
    [_BASE]: base,
    [_PROPAGATE]: propagate,
    get state() {
      return state;
    },
    layer: (signals, config) =>
      build(signals, { ...config, junctions: circuit }),
  });

  return parent.id ? circuit : deferredSignals.reduce(wire, circuit);
};

export default build;
