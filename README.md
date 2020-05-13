# short-circuit

A little state machine for Javascript applications that prefer to live outside of the DOM.

`short-circuit` is a cut down version of dom-circuit with element binding code stripped out leaving a tight, consistent state machine that organizes complex application logic into signal states.

Like its bigger brother, `short-circuit` acts like a live circuit where input signals drive state change through reducers into output signals. Output signals propagate through the circuit until they arrive, fully reduced, at the circuit terminal.

The following example leaves out the application render and item handling logic of a TODO application and focuses on the state changes that might be expected when these two aspects are brought together.

```
import circuit from 'short-circuit'
import {update, remove, total, done} from './reducers.js';
import render from './render'

const todo = circuit({
  add: (state, value) => (todo.items.update(value)),
  items: {
    update,
    remove,
  },
  footer: {
    'counts@/items': {
      total,
      done,
    },
  },
})(render);
```

In the example above, the `add`, `update` and `remove` signals are attached to appropriate React events. Each signalled reducer receives the current state and the new value. The new state is propagated through the circuit and passed into the render function.

## How it works

Circuits like the one above are constructed from `{signal: reducer}` and `{signal: circuit}` property types.

Signals can resolve to circuit identifiers, events or both - but always in structured order:

`(alias:)? (selector)? (@event)?` where:

- alias - signal identifier for semantic override is as in `add:count`
- selector - a circuit state identifier as in `count` accessed via `cct.state.count`
- event - one of
  - XPath selector prefixed by `@` as in `@/root/path/to/identifier`
  - `@init` - initial state event
  - `@state` - state change event

Each circuit identifier takes the value of the signal selector as its name. When this is not semantically appropriate or logical, an alias can be used.

```
circuit({
  'add:count' (({count}, value) => ({count: count + value}))
})({count: 1})

circuit.add(1) // => state.count = 2
```

Reducers follow the standard reducer argument pattern: `(state, value) => ({...state, value})`. The state passed into the reducer is the state of the immediate parent of the reducer property.

The value returned by the reducer will propagate through the circuit, bubbling up until it hits the circuit terminal function - an optional function that receives the changed circuit state:

```
const terminal = (state, id) => console.log(state, id)
circuit({
  'add: count': ({ count }, value) => ({ count: count + value }),
}, terminal)({
  count: 1,
});

circuit.add(1) // logs the current state => ({count: 2}, '/count')
```

Circuit state change can be actioned directly from within a reducer in several ways:

### Return a new state directly

```
  header: {
    add: (state, value) => ({...state, add: value}),
  },
```

State change propagation will bubble up through the circuit until it reaches the circuit terminal

### Propagate a sibling state

```
  header: {
    add: (state, value) =>({...state, updated: true}),
    updated: (state, value) => // reducer called with value === true
  },
```

State change propagation will be further reduced by sibling reducer(s) before bubbling up through the circuit until it reaches the circuit terminal.

### Jump to a new state

```
  header: {
    add: (state, value) => {
      todos.items.update(value)
      return // no return value
    }
  },
  items: {
    update: (items, value) => // reducer called with current items and new value
  }
```

State change propagation will jump to the referenced circuit reducer and then bubble up from that point until it reaches the circuit terminal.

### Bind to deferred state change

This pattern uses a simplified XPath syntax to bind a state change event to another state value.

```
  header: {
    add: (state, value) => ({state, latest: value}),
  },
  items: {
    '@/header/add': (items, value) => // reducer called with current items and latest update value
  }
```

State change propagation will be further reduced by deferred reducer(s) before bubbling up through the circuit until it reaches the circuit terminal. The deferred reducer will receive its own current state and the reduced state value from the initiating reducer.
