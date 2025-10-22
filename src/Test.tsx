
import CounterApp from './examples/counter/app'
import TodoApp from './examples/todo/app'
import FormApp from './examples/form/app'
import TimerApp from './examples/timer/app'
import CartApp from './examples/cart/app'
import { Playground } from './Playground'
import { useState } from 'react'

export const Test = () => {
    const [activeTab, setActiveTab] = useState<'counter' | 'todo' | 'form' | 'timer' | 'cart' | 'playground'>('playground')

    return (
        <div style={{ padding: '2rem', maxWidth: '1440px', margin: '0 auto' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>

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
                    <button
                        onClick={() => setActiveTab('playground')}
                        style={{
                            padding: '0.5rem 1rem',
                            background: activeTab === 'playground' ? '#28a745' : '#e0e0e0',
                            color: activeTab === 'playground' ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        🎮 Interactive Playground
                    </button>
                </div>
            </div>


            {activeTab != 'playground' && <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {activeTab === 'counter' && <CounterApp />}
                {activeTab === 'todo' && <TodoApp />}
                {activeTab === 'form' && <FormApp />}
                {activeTab === 'timer' && <TimerApp />}
                {activeTab === 'cart' && <CartApp />}
            </div>}

            <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
                {activeTab === 'playground' && <Playground />}
            </div>
        </div>
    )
}