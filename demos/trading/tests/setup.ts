import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetStores } from 'react-state-custom/testing'

configure({ reactStrictMode: true })

afterEach(() => {
  cleanup()
  resetStores()
})
