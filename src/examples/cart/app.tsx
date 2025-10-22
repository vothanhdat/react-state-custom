import { CartExample } from './view'

export default function App() {
    return (
        <>
            {/* <AutoRootCtx/> */}
            <CartExample userId="alice" />
            <CartExample userId="bob" />
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Shopping cart with product selection and quantity management.
                Shows how to handle derived state (total, itemCount) and complex state updates.
            </p>
            {/* <DevToolContainer Component={DataView} /> */}
        </>
    )
}
