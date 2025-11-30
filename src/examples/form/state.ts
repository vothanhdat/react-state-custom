import { createStore } from '../../index'
import { useState } from 'react'

export interface FormData {
    name: string
    email: string
    age: string
}

const useFormState = ({ formId }: { formId: string }) => {
    const [data, setData] = useState<FormData>({ name: '', email: '', age: '' })
    const [errors, setErrors] = useState<Partial<FormData>>({})
    const [submitted, setSubmitted] = useState(false)

    const validate = (data: FormData): Partial<FormData> => {
        const errors: Partial<FormData> = {}
        if (!data.name.trim()) errors.name = 'Name is required'
        if (!data.email.includes('@')) errors.email = 'Invalid email'
        if (data.age && isNaN(Number(data.age))) errors.age = 'Age must be a number'
        return errors
    }

    const updateField = (field: keyof FormData, value: string) => {
        setData(prev => ({ ...prev, [field]: value }))
        setErrors(prev => ({ ...prev, [field]: undefined }))
    }
    
    const submit = () => {
        const validationErrors = validate(data)
        if (Object.keys(validationErrors).length === 0) {
            setSubmitted(true)
            setTimeout(() => setSubmitted(false), 2000)
        } else {
            setErrors(validationErrors)
        }
    }
    
    const reset = () => {
        setData({ name: '', email: '', age: '' })
        setErrors({})
        setSubmitted(false)
    }

    return {
        formId,
        data,
        errors,
        submitted,
        updateField,
        submit,
        reset,
    }
}

export const { useStore: useFormStore } = createStore(
    "form",
    useFormState,
    5000
)
