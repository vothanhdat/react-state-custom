import { CartExample } from './view'
import '../examples.css'

export default function App() {
    return (
        <>
            <CartExample userId="alice" />
            <CartExample userId="bob" />
            <p className="example-description">
                Shopping cart with product selection and quantity management.
                Shows how to handle derived state (total, itemCount) and complex state updates.
            </p>
        </>
    )
}
