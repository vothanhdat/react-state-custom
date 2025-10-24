import { createRootCtx, createAutoCtx } from '../../index'
import { useCallback, useState } from 'react'

export interface CartItem {
    id: string
    name: string
    price: number
    quantity: number
}

export const PRODUCTS = [
    { id: '1', name: 'Apple', price: 1.5 },
    { id: '2', name: 'Banana', price: 0.8 },
    { id: '3', name: 'Orange', price: 1.2 },
    { id: '4', name: 'Mango', price: 2.5 },
]

const useCartState = ({ }) => {
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
        items,
        total: total.toFixed(2),
        itemCount,
        addItem,
        removeItem,
        updateQuantity,
        clear,
    }
}

export const { useCtxState: useCartCtx } = createAutoCtx(
    createRootCtx("cart", useCartState),
    5000
)
