# short-circuit

A little state machine for Javascript applications that prefer to live outside of the DOM.

`short-circuit` is a cut down version of dom-circuit with element binding code stripped out leaving a tight, declarative state machine that organizes complex application logic into predictable, intentional signal states.

Like its bigger brother, `short-circuit` acts like a live circuit where input signals drive state change through reducers that feed back into the circuit. Reduced signals propagate through the circuit until they arrive, fully reduced, at the circuit terminal.

The following example leaves out the application render and item handling logic of a TODO application and focuses on the state changes that might be expected when these two aspects are brought together.

```javascript
import circuit from 'short-circuit';
import { update, remove, total, done } from './reducers.js';
import render from './render';

const todo = circuit(
  {
    add(acc, value) {
      this.signal('/items/update', value);
    },
    items: {
      update,
      remove,
    },
    footer: {
      'counts$/items': {
        total,
        done,
      },
    },
  },
  { terminal: render }
);

// add an item
todo.add({ id: 1, text: 'A new item...' });
```

This little circuit captures the primary intent of a simple TODO application. Two state change patterns are employed: firstly, a direct signal state change when the user `add`s a new item, and secondly; an XPath deferred event to signal the `counts` state whenever items state changes.

## How it works

Circuits like the one above are constructed from `{signal: reducer}` and `{signal: circuit}` property types. Signal reducers like `add` use functional object methods with a standard reducer signature. Signal circuits like `items` build the overall circuit structure through composition: each nested circuit has its own state and terminal. Signals propagate through a circuit before bubbling up to and propagating through parent circuit state.

## Signals

Signals can resolve to circuit identifiers, events or both - but always in structured order:

`(alias:)? (selector)? ($event)? (_)?` where:

- alias - signal identifier for semantic override is as in `'add:count'`
- selector - a circuit state identifier as in `count` accessed via `cct.state.count`
- event - one of
  - XPath selector as in `'$/root/path/to/signal/selector'` or `'$../../relative/path'`
  - `init` - initial state event as in `ABC$init`
  - `state` - terminal state change event as in `ABC: { $state }`
- _ (underscore) - bind map function to handler as in `{fn_: value => value + 1}`

Signals can be applied across circuit properties to facilitate multiple binding scenarios. This items cct has three signal states: two event signals and an internal update state:

```javascript
{
  items: { // binds to the element with `class="items"`
    $click: (items, event) =>  // which item was clicked in event.target...
    $scroll: (items, event) => // scrolling now...
    update: (items, value) => [...items, value]
  }
}
```

Each circuit identifier takes the value of the signal selector as its name. When this is not semantically appropriate or logical, an alias can be used.

```javascript
const cct = circuit({
  'add:count' (({count}, value) => ({count: count + value}))
},{state: {count: 1}})

cct.add(1) // => state.count = 2
```

## Propagation

Input signals, whether from bound DOM events or from internal state change events, pass through a reducer before propagating through the circuit.

Propagation only occurs when a state value change is detected.

```javascript
const cct = circuit({
  state1: (acc, value) => acc // no state change so no propagation
  state1: (acc, value) => {return;} // no state change so no propagation
  state2: (acc, value) => ({...acc, state2: value}) // no signalled value change so no propagation
  state3: (acc, value) => ({...acc, state3: value + 1}) // propagate state change
})
```

## Reducers

Reducers follow the standard reducer argument pattern: `(acc, value) => ({...acc, value})`. The accumulated state passed into the reducer is the state of the immediate parent of the reducer property.

The state value returned by the reducer will propagate through the circuit, bubbling up until it hits the circuit terminal function - an optional `$state` signal handler:

```javascript
function terminal(state) => console.log(state, this.id);
const cct = circuit(
  {
    count: ({ count }, value) => ({ count: count + value }),
  },
  {
    state: {
      count: 1,
    },
    terminal
  }
});

cct.count(1); // logs the current state => {count: 2}, '/count'
```

### Map Reducers

When access to parent state is inappropriate, map reducer pattern can be substituted. The Map reducer follows the standard map argument pattern: `value => value` but the internal handler continues to reduce the mapped value into the parent state before propagating through the circuit.

Map reducers are registered by appending an underscore suffix to the signal selector:

```javascript
circuit({
  count_: (value) => value + 1,
});
```

### Reducer context

Reducer functions are called with _this_ context:

```javascript
const cct = circuit(
  {items: {
    '.item'(items, item) => {
      console.log(items, item, this) // =>
      // [1, 2, 3]
      // 2,
      // {
      //  id: current signal id '/items/item
      //  signal: an internal state change...
      // }
      return this.signal('../items')
    }
  }},
  { state: {
    items: [1,2,3],
  }
});
```

## State change

Circuit state change can be actioned directly from within a reducer in several ways:

### Return a new state directly

```javascript
  header: {
    add: (acc, value) => ({...acc, add: value}),
  },
```

State change propagation will bubble up through the circuit until it reaches the circuit terminal

### Signal a new state

```javascript
  header: {
    add: (acc, value) => {
      this.signal('/items/update',value)
      return // no return value: prevent bubbling
    }
  },
  items: {
    update: (items, value) => // reducer called with current items and new value
  }
```

Circuit state will jump to the referenced circuit signal selector and propagate to terminal. The `signal` function returns the signalled state. In this example above, propagation is halted by returning undefined. Otherwise propagation would continue to terminal in the expected manner.

### Bind to deferred state change

This pattern uses a simplified XPath syntax to bind a state change event to another state value change.

```javascript
  header: {
    add: (acc, value) => ({...acc, item: value}),
  },
  items: {
    '$/header/add': (items, {item}) => // reducer called with current items and item state
  }
```

State change propagation will be further reduced by deferred reducer(s) before bubbling up through the circuit until it reaches the circuit terminal. The deferred reducer will receive its own current state and the reduced state value from the initiating reducer.

## State change and signalling behavior

`short-circuit` flattens internal state changes into a predicable output signal. If a terminal is attached to the circuit, the output signal sequence is guaranteed to be aligned with the order of internal state change. This guarantee holds through asynchronous operations.

```javascript
function terminal() => console.log(this.id);

const cct = circuit(
  {
    s1(acc) {
      return Promise.resolve({ ...acc, s1: true }).then(() => {
        console.log(this.id);
        return this.signal('/s2', true);
      });
    },
    s2(acc) {
      return Promise.resolve({ ...acc, s2: true }).then(() => {
        console.log(this.id);
        return this.signal('/s3', true);
      });
    },
    s3: (acc) => Promise.resolve({ ...acc, s3: true }),
  },
  { terminal }
);

cct.s1(); // logs => '/s1', '/s2', '/s3'
```

## Key features appropriate to PI (Programmed Intentionality)

`short-circuit` aims to provide the same level of intentionality support as its big brother, namely the iconic and indexical intentionality patterns described there. But unlike `dom-circuit`, it does not provide signal / element binding out of the box. Instead `short-circuit` encourages another important pattern of intentionality - reentrancy.

Reentrancy is an intentional pattern whereby multiple third parties are able to reach agreement over shared intentionality whilst maintaining a coherent, independent, intentional stance. This works quite naturally at the team level: designers, managers, stakeholders all support and agree a shared intentionality. But programmed intentionality requires that such a pattern be captured as code; and in doing so, the code becomes the focus of agreement.

Here's an intentional statement: A TODO app maintains a filtered list of items. `short-circuit` explicitly codes this intentionality as a state machine. The nature of information that propagates through this state machine is irrelevant, it is the state changes that matter here. Reentrancy allows for the same intentionality to be considered across different intentional stances. Specifically, a state change observed in one stance correlates with a similar state change in another stance. In our example, a user adds a new TODO item. The circuit updates its internal representation of this state change. From the data stance, the items list has grown by one. From the display stance, the visible items list has been refreshed.

`short-circuit`'s layered circuits are an experimental reentrancy model.

## Layered Circuits (experimental)

`short-circuit` provides a very basic notion of integrated circuitry in which functionally isolated circuits are connected together at important points of agreement. Each layered circuit maintains its own state machine but state change propagation can be directed across layer boundaries through bi-directional junctions. A junction is simply a signal alignment where two selectors from different circuits are aligned on the same xpath.

Putting it all together in a React-ish kind of way:

```javascript
import React from 'react';
import { render } from 'react-dom';
import circuit from 'short-circuit';

// two independent circuits with signal alignment.

const data = {
  items: {
    add: (acc, item) => [...items, item],
  },
};

const view = {
  add_() {
    return <input onChange={(e) => this.signal('//items/add', e)} />;
  },
  items_: (items) => items.map((item) => <div>item</div>),
  $state: ({ items }) => <main>{items}</main>,
};

// A junction will be created on the xpath aligned `/items` selector
// allowing state change signals to cross over the layer boundary.

circuit(data, { state: { items: [] } }).layer(view, {
  terminal: (displayState) =>
    render(displayState, document.querySelector('#todo')),
});
```
