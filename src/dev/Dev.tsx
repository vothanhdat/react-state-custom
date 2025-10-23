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
    <>
      
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '20px',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          {/* Header */}
          <header style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h1 style={{
              margin: '0 0 10px 0',
              fontSize: '2rem',
              fontWeight: '700',
              color: '#333',
            }}>
              React State Custom
            </h1>
            <p style={{
              margin: 0,
              color: '#666',
              fontSize: '1rem',
            }}>
              Interactive examples demonstrating state management patterns
            </p>
          </header>

          {/* Example selector */}
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{
              margin: '0 0 15px 0',
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#333',
            }}>
              Select Example
            </h2>
            <div style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}>
              {(Object.keys(examples) as ExampleKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedExample(key)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: selectedExample === key ? '#007bff' : '#e9ecef',
                    color: selectedExample === key ? 'white' : '#333',
                    transition: 'all 0.2s',
                    boxShadow: selectedExample === key ? '0 2px 4px rgba(0,123,255,0.3)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedExample !== key) {
                      e.currentTarget.style.backgroundColor = '#dee2e6'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedExample !== key) {
                      e.currentTarget.style.backgroundColor = '#e9ecef'
                    }
                  }}
                >
                  {examples[key].title}
                </button>
              ))}
            </div>
          </div>

          {/* Example content */}
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{
              margin: '0 0 10px 0',
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#333',
            }}>
              {example.title}
            </h2>
            <p style={{
              margin: '0 0 20px 0',
              color: '#666',
              fontSize: '0.95rem',
              lineHeight: '1.5',
            }}>
              {example.description}
            </p>
            <div style={{
              borderTop: '1px solid #e9ecef',
              paddingTop: '20px',
            }}>
              {example.component}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}