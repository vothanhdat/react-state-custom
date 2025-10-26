import { useState } from 'react'
import './dev.css'

// Import all example apps
import CounterApp from '../examples/counter/app'
import TodoApp from '../examples/todo/app'
import FormApp from '../examples/form/app'
import TimerApp from '../examples/timer/app'
import CartApp from '../examples/cart/app'


// Example configurations
const examples = {
  counter: {
    title: '🔢 Counter',
    description: 'A simple counter demonstrating basic state management with increment, decrement, and reset operations.',
    component: <CounterApp />,
  },
  todo: {
    title: '✅ Todo List',
    description: 'Multiple independent todo lists showing how contexts can be scoped by parameters. Each list maintains its own state.',
    component: <TodoApp />,
  },
  form: {
    title: '📝 Form Validation',
    description: 'Form validation example with multiple independent form instances. Shows real-time validation and error handling.',
    component: <FormApp />,
  },
  timer: {
    title: '⏱️ Timer',
    description: 'Multiple independent timers with millisecond precision demonstrating side effects and cleanup.',
    component: <TimerApp />,
  },
  cart: {
    title: '🛒 Shopping Cart',
    description: 'Shopping cart with product selection and quantity management. Shows derived state (total, itemCount) and complex updates.',
    component: <CartApp />,
  },
} as const

type ExampleKey = keyof typeof examples

export const Dev = () => {
  const [selectedExample, setSelectedExample] = useState<ExampleKey>('counter')
  const example = examples[selectedExample]

  return (
    <main className="container">
      <header>
        <hgroup>
          <h1>React State Custom</h1>
          <p>Interactive examples demonstrating state management patterns</p>
        </hgroup>
      </header>

      <section>
        <h2>Select Example</h2>
        <div className="grid">
          {(Object.keys(examples) as ExampleKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedExample(key)}
              className={selectedExample === key ? 'contrast' : 'secondary'}
            >
              {examples[key].title}
            </button>
          ))}
        </div>
      </section>

      <article>
        <header>
          <h2>{example.title}</h2>
          <p>{example.description}</p>
        </header>
        {example.component}
      </article>
    </main>
  )
}