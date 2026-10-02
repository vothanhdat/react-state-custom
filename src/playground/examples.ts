// Example files
import counterState from "../examples/counter/state.ts?raw"
import counterView from "../examples/counter/view.tsx?raw"
import counterApp from "../examples/counter/app.tsx?raw"
import todoState from "../examples/todo/state.ts?raw"
import todoView from "../examples/todo/view.tsx?raw"
import todoApp from "../examples/todo/app.tsx?raw"
import timerState from "../examples/timer/state.ts?raw"
import timerView from "../examples/timer/view.tsx?raw"
import timerApp from "../examples/timer/app.tsx?raw"
import formState from "../examples/form/state.ts?raw"
import formView from "../examples/form/view.tsx?raw"
import formApp from "../examples/form/app.tsx?raw"
import cartState from "../examples/cart/state.ts?raw"
import cartView from "../examples/cart/view.tsx?raw"
import cartApp from "../examples/cart/app.tsx?raw"
import asyncState from "../examples/async/state.ts?raw"
import asyncView from "../examples/async/view.tsx?raw"
import asyncApp from "../examples/async/app.tsx?raw"
import composeState from "../examples/compose/state.ts?raw"
import composeView from "../examples/compose/view.tsx?raw"
import composeApp from "../examples/compose/app.tsx?raw"
import scopeState from "../examples/scope/state.ts?raw"
import scopeView from "../examples/scope/view.tsx?raw"
import scopeApp from "../examples/scope/app.tsx?raw"

const updateImport = (code: string) => {
    return code.replaceAll(
        `from '../../index'`,
        `from 'react-state-custom'`
    )
}

export interface Example {
    label: string
    title: string
    description: string
    state: string
    view: string
    app: string
}

export const examples = {
    counter: {
        label: '🔢 Counter',
        title: 'Counter',
        description: 'A single global store with initialState. Increment, decrement and reset from anywhere; every consumer sees the same count.',
        state: updateImport(counterState),
        view: updateImport(counterView),
        app: updateImport(counterApp),
    },
    todo: {
        label: '✅ Todo List',
        title: 'Todo List',
        description: 'Multiple independent todo lists: the listId param becomes part of the store identity, so each list gets its own instance.',
        state: updateImport(todoState),
        view: updateImport(todoView),
        app: updateImport(todoApp),
    },
    form: {
        label: '📝 Form',
        title: 'Form Validation',
        description: 'Two independent form instances keyed by formId, with validation and error state living in the store.',
        state: updateImport(formState),
        view: updateImport(formView),
        app: updateImport(formApp),
    },
    timer: {
        label: '⏱️ Timer',
        title: 'Timer',
        description: 'Multiple independent timers with setInterval inside the store hook. Effects and cleanup work exactly as in a normal hook.',
        state: updateImport(timerState),
        view: updateImport(timerView),
        app: updateImport(timerApp),
    },
    cart: {
        label: '🛒 Cart',
        title: 'Shopping Cart',
        description: 'Shopping cart with product selection and quantity management. Shows how to handle derived state (total, itemCount) and complex state updates.',
        state: updateImport(cartState),
        view: updateImport(cartView),
        app: updateImport(cartApp),
    },
    async: {
        label: '🌐 Async Data',
        title: 'Async Data',
        description: 'Fetch inside the store hook with a plain useEffect. Several consumers share one request, initialState provides the loading state on first render, and timeToClean caches the result after the last consumer unmounts.',
        state: updateImport(asyncState),
        view: updateImport(asyncView),
        app: updateImport(asyncApp),
    },
    compose: {
        label: '🧩 Composed Stores',
        title: 'Composed Stores',
        description: 'A per-invoice store that reads a global settings store from inside its own hook. Change the tax rate once and every invoice recomputes.',
        state: updateImport(composeState),
        view: updateImport(composeView),
        app: updateImport(composeApp),
    },
    scope: {
        label: '🎭 Scoped State',
        title: 'Scoped State',
        description: 'StateScopeProvider gives a subtree its own isolated store instances. The same store definition yields shared state globally and independent state inside each provider.',
        state: updateImport(scopeState),
        view: updateImport(scopeView),
        app: updateImport(scopeApp),
    },
} as const

export type ExampleKey = keyof typeof examples
