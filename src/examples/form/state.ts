import { createRootCtx, createAutoCtx } from '../../index'
import { useCallback, useState } from 'react'

export interface FormData {
    name: string
    email: string
    age: string
}

const useFormState = ({ }) => {
    const [data, setData] = useState<FormData>({ name: '', email: '', age: '' })
    const [errors, setErrors] = useState<Partial<FormData>>({})
    const [submitted, setSubmitted] = useState(false)

    const validate = useCallback((data: FormData): Partial<FormData> => {
        const errors: Partial<FormData> = {}
        if (!data.name.trim()) errors.name = 'Name is required'
        if (!data.email.includes('@')) errors.email = 'Invalid email'
        if (data.age && isNaN(Number(data.age))) errors.age = 'Age must be a number'
        return errors
    }, [])

    const updateField = useCallback((field: keyof FormData, value: string) => {
        setData(prev => ({ ...prev, [field]: value }))
        setErrors(prev => ({ ...prev, [field]: undefined }))
    }, [])
    
    const submit = useCallback(() => {
        const validationErrors = validate(data)
        if (Object.keys(validationErrors).length === 0) {
            setSubmitted(true)
            setTimeout(() => setSubmitted(false), 2000)
        } else {
            setErrors(validationErrors)
        }
    }, [data, validate])
    
    const reset = useCallback(() => {
        setData({ name: '', email: '', age: '' })
        setErrors({})
        setSubmitted(false)
    }, [])

    return {
        data,
        errors,
        submitted,
        updateField,
        submit,
        reset,
    }
}

export const { useCtxState: useFormCtx } = createAutoCtx(
    createRootCtx("form", useFormState),
    5000
)
