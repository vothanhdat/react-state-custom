import { useQuickSubscribe } from '../../index'
import { useFormCtx } from './state'
import '../examples.css'

export const FormExample = ({ formId = "user-form" }: { formId?: string }) => {
    const { data, errors, submitted, updateField, submit, reset } = 
        useQuickSubscribe(useFormCtx({ formId }))

    return (
        <article className="example-container">
            <h3>Form ({formId})</h3>
            {submitted && (
                <div className="form-success-message">
                    Form submitted successfully!
                </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); submit?.(); }}>
                <div className="form-group">
                    <label htmlFor={`name-${formId}`}>Name:</label>
                    <input
                        id={`name-${formId}`}
                        value={data?.name ?? ''}
                        onChange={(e) => updateField?.('name', e.target.value)}
                        aria-invalid={errors?.name ? 'true' : undefined}
                    />
                    {errors?.name && <div className="form-error">{errors.name}</div>}
                </div>
                <div className="form-group">
                    <label htmlFor={`email-${formId}`}>Email:</label>
                    <input
                        id={`email-${formId}`}
                        type="email"
                        value={data?.email ?? ''}
                        onChange={(e) => updateField?.('email', e.target.value)}
                        aria-invalid={errors?.email ? 'true' : undefined}
                    />
                    {errors?.email && <div className="form-error">{errors.email}</div>}
                </div>
                <div className="form-group">
                    <label htmlFor={`age-${formId}`}>Age:</label>
                    <input
                        id={`age-${formId}`}
                        type="number"
                        value={data?.age ?? ''}
                        onChange={(e) => updateField?.('age', e.target.value)}
                        aria-invalid={errors?.age ? 'true' : undefined}
                    />
                    {errors?.age && <div className="form-error">{errors.age}</div>}
                </div>
                <div className="form-actions">
                    <button type="submit">Submit</button>
                    <button type="button" onClick={reset}>Reset</button>
                </div>
            </form>
        </article>
    )
}

export default FormExample
