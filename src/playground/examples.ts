import type { ComponentType } from 'react'

// Live example apps (rendered natively in the playground)
import CounterApp from '../examples/counter/app'
import TodoApp from '../examples/todo/app'
import SelectorsApp from '../examples/selectors/app'
import TimerApp from '../examples/timer/app'
import OutsideApp from '../examples/outside/app'
import AsyncApp from '../examples/async/app'
import ComposeApp from '../examples/compose/app'
import ScopeApp from '../examples/scope/app'

// Example sources (shown in the code pane and sent to StackBlitz)
import counterState from "../examples/counter/state.ts?raw"
import counterView from "../examples/counter/view.tsx?raw"
import counterApp from "../examples/counter/app.tsx?raw"
import todoState from "../examples/todo/state.ts?raw"
import todoView from "../examples/todo/view.tsx?raw"
import todoApp from "../examples/todo/app.tsx?raw"
import timerState from "../examples/timer/state.ts?raw"
import timerView from "../examples/timer/view.tsx?raw"
import timerApp from "../examples/timer/app.tsx?raw"
import selectorsState from "../examples/selectors/state.ts?raw"
import selectorsView from "../examples/selectors/view.tsx?raw"
import selectorsApp from "../examples/selectors/app.tsx?raw"
import outsideState from "../examples/outside/state.ts?raw"
import outsideView from "../examples/outside/view.tsx?raw"
import outsideApp from "../examples/outside/app.tsx?raw"
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
    App: ComponentType
    state: string
    view: string
    app: string
    /** Run in the global scope (needed by getStore) instead of an isolated StateScopeProvider. */
    global?: boolean
}

export const examples = {
    counter: {
        App: CounterApp,
        label: '🔢 Counter',
        title: 'Counter',
        description: 'A single global store with initialState. Increment, decrement and reset from anywhere; every consumer sees the same count.',
        state: updateImport(counterState),
        view: updateImport(counterView),
        app: updateImport(counterApp),
    },
    todo: {
        App: TodoApp,
        label: '✅ Todo List',
        title: 'Todo List',
        description: 'Multiple independent todo lists: the listId param becomes part of the store identity, so each list gets its own instance.',
        state: updateImport(todoState),
        view: updateImport(todoView),
        app: updateImport(todoApp),
    },
    timer: {
        App: TimerApp,
        label: '⏱️ Timer',
        title: 'Timer',
        description: 'Multiple independent timers with setInterval inside the store hook. Effects and cleanup work exactly as in a normal hook.',
        state: updateImport(timerState),
        view: updateImport(timerView),
        app: updateImport(timerApp),
    },
    selectors: {
        App: SelectorsApp,
        label: '🎯 Selectors',
        title: 'Selectors and Suspense',
        description: 'Every action replaces the whole profile object. useStore(params, selector) re-renders a component only when its selected value changes (with a custom isEqual for arrays), and useStoreSuspense drops the loading branch in favour of a Suspense boundary. Watch the render counters.',
        state: updateImport(selectorsState),
        view: updateImport(selectorsView),
        app: updateImport(selectorsApp),
    },
    async: {
        App: AsyncApp,
        label: '🌐 Async Data',
        title: 'Async Data',
        description: 'Fetch inside the store hook with a plain useEffect. Several consumers share one request, initialState provides the loading state on first render, and timeToClean caches the result after the last consumer unmounts.',
        state: updateImport(asyncState),
        view: updateImport(asyncView),
        app: updateImport(asyncApp),
    },
    compose: {
        App: ComposeApp,
        label: '🧩 Composed Stores',
        title: 'Composed Stores',
        description: 'Stores compose like hooks. A per-invoice store reads the global settings store, and a summary store reads both invoice stores. Move the tax slider or add a line and every level recomputes: settings → invoice → summary.',
        state: updateImport(composeState),
        view: updateImport(composeView),
        app: updateImport(composeApp),
    },
    outside: {
        App: OutsideApp,
        label: '🔌 Outside React',
        title: 'Outside React',
        description: 'getStore() is the imperative handle: a price feed written as plain module code keeps the store alive with retain() and pushes updates through get().setPrice, while subscribe() delivers every change with its key. Open the console for get() snapshots.',
        state: updateImport(outsideState),
        view: updateImport(outsideView),
        app: updateImport(outsideApp),
        global: true,
    },
    scope: {
        App: ScopeApp,
        label: '🎭 Scoped State',
        title: 'Scoped State',
        description: 'StateScopeProvider gives a subtree its own isolated store instances. The same store definition yields shared state globally and independent state inside each provider.',
        state: updateImport(scopeState),
        view: updateImport(scopeView),
        app: updateImport(scopeApp),
    },
} as const

export type ExampleKey = keyof typeof examples
