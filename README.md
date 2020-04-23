# dom-circuit

The least opinionated, opinionated state management for DOM applications and other kinds of state machine.

`dom-circuit` is not a framework or a library, but a small utility function that helps to bind DOM elements and their attributes into a live circuit.

The following example leaves out the HTML markup detail and item handling logic of a TODO application and focuses on the state changes that might be expected when these two aspects are brought together.

```
import DOMcircuit from 'dom-circuit'
import {update, remove, total, done} from './reducers.js;

const todo = DOMcircuit({
  header: {
    '#add onchange': (state, value) => (todo.items.update = value),
  },
  '#items': {
    update,
    'remove onclick': remove,
  },
  footer: {
    'counts/items': {
      #total,
      #done,
    },
  },
});
```

And that's really the point of `dom-circuit`. It doesn't attempt to abstract over the DOM or its event system; nor does it provide any kind of event normalisation or facility to process event data. However, it does make a compelling case for declaratively binding to the minimal set of elements that influence an application's state and hence its behavior.

## How it works

Circuits like the one above are constructed from `{selector: reducer}` and `{selector: circuit}` property types.

Selectors can resolve to elements, circuit properties, events or any combination of them all - but always in structured order:

`(alias:)? (/? selector)? (.?onevent)?` where:

- alias - circuit identifier when selector is too noisy as in `xOpen:#x.open[arg=123]`
- selector - one of
  - valid DOM selector via querySelectorAll as in `'.classname > .classname'`
  - XPath selector as in `/path/to/circuit/prop`
- event - one of
  - valid DOM eventListener prefixed by `\son` or `.on` as in `onclick` or `.onmousemove`
  - as above + event options as in `onclick{passive: true}`

Selectors can be distributed across circuit properties to facilitate multiple binding scenarios:

```
{
  '#items' :{ // binds to the element with `id=items`
    onclick: (items, event) => // which item was clicked?...
    onscroll: (items, event) => // er, scrolling now...
    add: (items, value) => [...items, value]
  }
}
```

Reducers follow the standard reducer argument pattern: `(state, value) => ({...state, value})`. The state passed into the reducer is the state of the immediate parent of the reducer property. Read only values on the full circuit state can be explicitly accessed as `circuit.state`.

Circuit state change can be actioned directly from within a reducer in several ways.

### Return a new state directly

```
  header: {
    #add: (state, value) => ({...state, add: value}),
  },
```

### Propagate a sibling state

```
  header: {
    #add: (state, value) =>({...state, updated: true}),
    updated: (state, value) => // reducer called with value === true
  },
```

### Jump to a new state

```
  header: {
    #add: (state, value) => (todos.items.update = value),
  },
  items: {
    update: (items, value) => // reducer called with current items and new value
  }
```

### Bind to deferred state change

This pattern uses a simplified XPath syntax to bind a property to another state value change.

```
  header: {
    #add: (state, value) => ({state, latest: value}),
  },
  items: {
    '/header/add': (items, value) => // reducer called with current items and latest value
  }
```
