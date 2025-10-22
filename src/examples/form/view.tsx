import { useQuickSubscribe } from '../../index'
import { useFormCtx } from './state'

export const FormExample = ({ formId = "user-form" }: { formId?: string }) => {
    const { data, errors, submitted, updateField, submit, reset } = 
        useQuickSubscribe(useFormCtx({ formId }))

    return (
        <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
            <h3>Form ({formId})</h3>
            {submitted && (
                <div style={{ padding: '0.5rem', background: '#d4edda', color: '#155724', marginBottom: '1rem' }}>
                    Form submitted successfully!
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem' }}>Name:</label>
                    <input
                        value={data?.name ?? ''}
                        onChange={(e) => updateField?.('name', e.target.value)}
                        style={{ width: '100%', padding: '0.25rem' }}
                    />
                    {errors?.name && <div style={{ color: 'red', fontSize: '0.875rem' }}>{errors.name}</div>}
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem' }}>Email:</label>
                    <input
                        value={data?.email ?? ''}
                        onChange={(e) => updateField?.('email', e.target.value)}
                        style={{ width: '100%', padding: '0.25rem' }}
                    />
                    {errors?.email && <div style={{ color: 'red', fontSize: '0.875rem' }}>{errors.email}</div>}
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem' }}>Age:</label>
                    <input
                        value={data?.age ?? ''}
                        onChange={(e) => updateField?.('age', e.target.value)}
                        style={{ width: '100%', padding: '0.25rem' }}
                    />
                    {errors?.age && <div style={{ color: 'red', fontSize: '0.875rem' }}>{errors.age}</div>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={submit}>Submit</button>
                    <button onClick={reset}>Reset</button>
                </div>
            </div>
        </div>
    )
}

export default FormExample
