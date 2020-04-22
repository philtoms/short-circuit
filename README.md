# dom-circuit

The smallest, least opinionated, opinionated state management for DOM applications and other kinds of state machine.

`dom-circuit` is not a framework or a library, but a small utility function that helps to bind DOM elements and their attributes into a live circuit.

It doesn't attempt to abstract over the DOM or its event system; nor does it provide any kind of event normalisation or facility to process event data. However, it does make a compelling case for fast-track binding to the minimal set of elements that influence an application's state and hence its behavior.

```
import DOMCircuit from 'dom-circuit'

import {add, update, remove} from './todo-actions.js'

const todos = DOMCircuit({
  header: {
    add: todos.add
  },
  '#todos: {
    add,
    todo: {
      input: update
      button: remove
    }
  },
  footer: {
    count
  }
})({todos: []})
```

```
export const add => (todos, newItem) => [...todos, newItem]
export const update => ()
```

## How it works

`dom-circuit` takes an object (a map of CSS selectors and event handlers) as an argument and returns a function that takes an initial state and returns a signalled state machine - the circuit.

```
// a circuit with just one live handler
circuit = DOMCircuit({
  '#counter': ({counter}, value) => ({counter:counter + value})
})({counter: 1})

circuit.counter = 4 // ==> {counter: 5}
```

The object passed into dom-circuit is a map of key-values that represent application state. Each key is a state address that can be signalled to change state. Its value is a reducer function that receives the current state and the signalled value and returns a new state. If the new state updates the or the state of another nested circuit.

State change is activated through signalling. Signals represent, and thus can be raised by:

1. signal addressing - eg 'mySignal' a direct call to circuit.mySignal(value)
2. CSS selectors - eg '#myForm.password' called through mutation observers
3. DOM event listeners - eg 'onclick' called when parent selector is clicked or...
4. any or all of the above - eg 'button@onclick:myButton'

Signals bubble up through the circuit and state changes propagate downwards through the circuit.

## Tips

For performance reasons, `dom-circuit` only registers mutation observers for the pseudo `onmutation` signal, so

```
// https://developer.mozilla.org/en-US/docs/Web/API/MutationObserverInit,
myStateMachine = DOMCircuit({
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
