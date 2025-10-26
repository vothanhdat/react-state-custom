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

const updateImport = (code: string) => {
    return code.replaceAll(
        `from '../../index'`,
        `from 'react-state-custom'`
    )
}

const injectRootCtx = (code: string) => {
    return [
        `import { AutoRootCtx, DevToolContainer } from 'react-state-custom';`,
        `import 'react-state-custom/dist/react-state-custom.css';`,
        `import { DataView } from './dataview.tsx';`,
        code
            .replaceAll(
                `{/* <AutoRootCtx/> */}`,
                `<AutoRootCtx/>`
            ).replaceAll(
                `{/* <DevToolContainer Component={DataView} /> */}`,
                `<DevToolContainer Component={DataView} style={{ left:"20px", bottom:"10px", right:"unset"}}/>`,
            )
    ].join("\n")
}

export interface Example {
    title: string
    description: string
    state: string
    view: string
    app: string
}

export const examples = {
    counter: {
        title: 'Counter Example',
        description: 'A simple counter demonstrating basic state management with increment, decrement, and reset operations.',
        state: updateImport(counterState),
        view: updateImport(counterView),
        app: injectRootCtx(updateImport(counterApp)),
    },
    todo: {
        title: 'Todo List Example',
        description: 'Multiple independent todo lists showing how contexts can be scoped by parameters.',
        state: updateImport(todoState),
        view: updateImport(todoView),
        app: injectRootCtx(updateImport(todoApp)),
    },
    form: {
        title: 'Form Example',
        description: 'Form validation example with multiple independent form instances. Shows real-time validation and error handling.',
        state: updateImport(formState),
        view: updateImport(formView),
        app: injectRootCtx(updateImport(formApp)),
    },
    timer: {
        title: 'Timer Example',
        description: 'Multiple independent timers with millisecond precision demonstrating side effects.',
        state: updateImport(timerState),
        view: updateImport(timerView),
        app: injectRootCtx(updateImport(timerApp)),
    },
    cart: {
        title: 'Shopping Cart Example',
        description: 'Shopping cart with product selection and quantity management. Shows how to handle derived state (total, itemCount) and complex state updates.',
        state: updateImport(cartState),
        view: updateImport(cartView),
        app: injectRootCtx(updateImport(cartApp)),
    }
} as const

export type ExampleKey = keyof typeof examples
