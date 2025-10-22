
import { CounterExample } from './examples/CounterExample'
import { TodoExample } from './examples/TodoExample'
import { FormExample } from './examples/FormExample'
import { TimerExample } from './examples/TimerExample'
import { CartExample } from './examples/CartExample'
import { useState } from 'react'

export const Test = () => {
    const [activeTab, setActiveTab] = useState<'counter' | 'todo' | 'form' | 'timer' | 'cart'>('counter')

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1>React State Custom - Examples</h1>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button 
                    onClick={() => setActiveTab('counter')}
                    style={{ 
                        padding: '0.5rem 1rem',
                        background: activeTab === 'counter' ? '#007bff' : '#e0e0e0',
                        color: activeTab === 'counter' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Counter
                </button>
                <button 
                    onClick={() => setActiveTab('todo')}
                    style={{ 
                        padding: '0.5rem 1rem',
                        background: activeTab === 'todo' ? '#007bff' : '#e0e0e0',
                        color: activeTab === 'todo' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Todo List
                </button>
                <button 
                    onClick={() => setActiveTab('form')}
                    style={{ 
                        padding: '0.5rem 1rem',
                        background: activeTab === 'form' ? '#007bff' : '#e0e0e0',
                        color: activeTab === 'form' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Form
                </button>
                <button 
                    onClick={() => setActiveTab('timer')}
                    style={{ 
                        padding: '0.5rem 1rem',
                        background: activeTab === 'timer' ? '#007bff' : '#e0e0e0',
                        color: activeTab === 'timer' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Timer
                </button>
                <button 
                    onClick={() => setActiveTab('cart')}
                    style={{ 
                        padding: '0.5rem 1rem',
                        background: activeTab === 'cart' ? '#007bff' : '#e0e0e0',
                        color: activeTab === 'cart' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Shopping Cart
                </button>
            </div>

            <div>
                {activeTab === 'counter' && (
                    <>
                        <CounterExample />
                        <p style={{ color: '#666', fontSize: '0.875rem' }}>
                            A simple counter demonstrating basic state management with increment, decrement, and reset operations.
                        </p>
                    </>
                )}
                
                {activeTab === 'todo' && (
                    <>
                        <TodoExample listId="main" />
                        <TodoExample listId="work" />
                        <p style={{ color: '#666', fontSize: '0.875rem' }}>
                            Multiple independent todo lists showing how contexts can be scoped by parameters (listId).
                            Each list maintains its own state.
                        </p>
                    </>
                )}
                
                {activeTab === 'form' && (
                    <>
                        <FormExample formId="registration" />
                        <FormExample formId="profile" />
                        <p style={{ color: '#666', fontSize: '0.875rem' }}>
                            Form validation example with multiple independent form instances.
                            Shows real-time validation and error handling.
                        </p>
                    </>
                )}
                
                {activeTab === 'timer' && (
                    <>
                        <TimerExample timerId="timer1" />
                        <TimerExample timerId="timer2" />
                        <p style={{ color: '#666', fontSize: '0.875rem' }}>
                            Multiple independent timers demonstrating side effects (setInterval) within context state.
                            Each timer can run independently.
                        </p>
                    </>
                )}
                
                {activeTab === 'cart' && (
                    <>
                        <CartExample userId="alice" />
                        <CartExample userId="bob" />
                        <p style={{ color: '#666', fontSize: '0.875rem' }}>
                            Shopping cart with product selection and quantity management.
                            Shows how to handle derived state (total, itemCount) and complex state updates.
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}