import { useCartStore, PRODUCTS } from './state'

export const CartExample = ({ userId = "user1" }: { userId?: string }) => {
    const { items, total, itemCount, addItem, removeItem, updateQuantity, clear } =
        useCartStore({ userId })

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

export default CartExample
