import { createAutoCtx } from '../state-utils/createAutoCtx'
import { createRootCtx } from '../state-utils/createRootCtx'
import { useCallback, useState } from 'react'
import { useQuickSubscribe } from '../state-utils/useQuickSubscribe'

interface CartItem {
    id: string
    name: string
    price: number
    quantity: number
}

const PRODUCTS = [
    { id: '1', name: 'Apple', price: 1.5 },
    { id: '2', name: 'Banana', price: 0.8 },
    { id: '3', name: 'Orange', price: 1.2 },
    { id: '4', name: 'Mango', price: 2.5 },
]

const { useCtxState: useCartCtx } = createAutoCtx(
    createRootCtx(
        "cart",
        ({ userId }: { userId: string }) => {
            const [items, setItems] = useState<CartItem[]>([])

            const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
            const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

            const addItem = useCallback((product: typeof PRODUCTS[0]) => {
                setItems(prev => {
                    const existing = prev.find(i => i.id === product.id)
                    if (existing) {
                        return prev.map(i => 
                            i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
                        )
                    }
                    return [...prev, { ...product, quantity: 1 }]
                })
            }, [])
            
            const removeItem = useCallback((id: string) => {
                setItems(prev => prev.filter(i => i.id !== id))
            }, [])
            
            const updateQuantity = useCallback((id: string, quantity: number) => {
                if (quantity <= 0) {
                    setItems(prev => prev.filter(i => i.id !== id))
                } else {
                    setItems(prev => prev.map(i => 
                        i.id === id ? { ...i, quantity } : i
                    ))
                }
            }, [])
            
            const clear = useCallback(() => setItems([]), [])

            return {
                userId,
                items,
                total: total.toFixed(2),
                itemCount,
                addItem,
                removeItem,
                updateQuantity,
                clear,
            }
        }
    )
)

export const CartExample = ({ userId = "user1" }: { userId?: string }) => {
    const { items, total, itemCount, addItem, removeItem, updateQuantity, clear } = 
        useQuickSubscribe(useCartCtx({ userId }))

    return (
        <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
            <h3>Shopping Cart ({userId})</h3>
            <div style={{ marginBottom: '1rem' }}>
                <h4>Products:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {PRODUCTS.map(product => (
                        <button
                            key={product.id}
                            onClick={() => addItem?.(product)}
                            style={{ padding: '0.5rem' }}
                        >
                            {product.name} - ${product.price.toFixed(2)}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <h4>Cart ({itemCount ?? 0} items):</h4>
                {(items?.length ?? 0) === 0 ? (
                    <p style={{ color: '#666' }}>Cart is empty</p>
                ) : (
                    <>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {items?.map(item => (
                                <li key={item.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ flex: 1 }}>{item.name}</span>
                                    <span>${item.price.toFixed(2)}</span>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity?.(item.id, parseInt(e.target.value) || 0)}
                                        style={{ width: '3rem', padding: '0.25rem' }}
                                        min="0"
                                    />
                                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                                    <button onClick={() => removeItem?.(item.id)}>×</button>
                                </li>
                            ))}
                        </ul>
                        <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                            <span>Total:</span>
                            <span>${total}</span>
                        </div>
                        <button onClick={clear} style={{ marginTop: '0.5rem', width: '100%' }}>
                            Clear Cart
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
