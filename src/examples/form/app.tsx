import { FormExample } from './view'

export default function App() {
    return (
        <>
            
            <FormExample formId="registration" />
            <FormExample formId="profile" />
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Form validation example with multiple independent form instances.
                Shows real-time validation and error handling.
            </p>
            
        </>
    )
}
