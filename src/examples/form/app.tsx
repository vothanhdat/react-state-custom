import { FormExample } from './view'
import '../examples.css'

export default function App() {
    return (
        <>
            <FormExample formId="registration" />
            <FormExample formId="profile" />
            <p className="example-description">
                Form validation example with multiple independent form instances.
                Shows real-time validation and error handling.
            </p>
        </>
    )
}
