import { useQuickSubscribe } from '../../index'
import { useCartCtx, PRODUCTS } from './state'
import '../examples.css'

export const CartExample = ({ userId = "user1" }: { userId?: string }) => {
    const { items, total, itemCount, addItem, removeItem, updateQuantity, clear } =
        useQuickSubscribe(useCartCtx({ userId }))

    return (
        <article className="example-container">
            <h3>Shopping Cart ({userId})</h3>
            <div className="cart-products">
                <h4>Products:</h4>
                <div className="product-grid">
                    {PRODUCTS.map(product => (
                        <button
                            key={product.id}
                            onClick={() => addItem?.(product)}
                        >
                            {product.name} - ${product.price.toFixed(2)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="cart-section">
                <h4>Cart ({itemCount ?? 0} items):</h4>
                {(items?.length ?? 0) === 0 ? (
                    <p className="cart-empty">Cart is empty</p>
                ) : (
                    <>
                        <ul className="cart-list">
                            {items?.map(item => (
                                <li key={item.id} className="cart-item">
                                    <span className="cart-item-name">{item.name}</span>
                                    <span>${item.price.toFixed(2)}</span>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => updateQuantity?.(item.id, parseInt(e.target.value) || 0)}
                                        min="0"
                                    />
                                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                                    <button onClick={() => removeItem?.(item.id)}>×</button>
                                </li>
                            ))}
                        </ul>
                        <div className="cart-total">
                            <span>Total:</span>
                            <span>${total}</span>
                        </div>
                        <button onClick={clear} className="cart-clear">
                            Clear Cart
                        </button>
                    </>
                )}
            </div>
        </article>
    )
}

export default CartExample
