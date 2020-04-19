# circuit-state

The smallest, least opinionated, opinionated state management for DOM applications and other kinds of state machine.

`circuit-state` is neither a framework or a library. It does not attempt to abstract over the DOM or its event system; nor does it provide any kind of event normalisation or facility to process event data. Strictly speaking it is a singular utility function. However, it does make a compelling case for fast-track binding to the minimal set of elements that influence an application's state and hence its behaviour.

## How it works

`circuit-state` takes an object as an argument and returns a function that takes an object as initial state and returns a state machine - the circuit.

```
myStateMachine = circuitState({counter: value => value + 1)({counter: 1}) // myStateMachine.counter === 2

myStateMachine.counter(4) // ==> 5
```

The object passed into circuit-state is a map of key-values that represent application state. Each key is a state address that can be signalled, and its value is either a map function, a reducer function or the state of another nested circuit.

State change is activated through signalling. Signals represent, and thus can be raised by:

1. signal addressing - eg 'mySignal' a direct call to circuit.mySignal(value)
2. CSS selectors - eg '#myForm.password' called through mutation observers
3. DOM event listeners - eg 'onclick' called when parent selector is clicked or...
4. any or all of the above - eg 'button@onclick:myButton'

Signals bubble up through the circuit and state changes propagate downwards through the circuit.

## Tips

For performance reasons, `circuit-state` only registers mutation observers for the pseudo `onmutation` signal, so

```
// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserverInit,
myStateMachine = circuitState({
  counter@onmutation: (mutations => ...)(MutationObserverInit)
})
```

```
app = circuit({
  header: {
    'node': {
      click: e => e.target.value
    },
    '.class@mousemove': e => e.pageX,
    'selector:alias@event': (state, value) => e.pageX,
  },
  main: {
    signal: handler
    signal: ({header: {alias}}) => app.header.alias(alias + 1)
  },
  footer: {
  },
})(state)
```

circuit actions
circuits
are signalled state machines
are constructed from object graphs
are connectable
are object keys (`signal@event:alias`)
signals
constructed by one or all of
signal = signal address
:alias = optional alias address
@event = optional signal binding
eagerly map to
events 'onevent'
CSS selectors via cascade
signal handlers
are reducers = (state, value, idx) -> state
are propagators
returned state propagates through circuit
return undefined to halt signal propagation
reenter circuit via signal.path
