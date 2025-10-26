// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import "babel-plugin-react-compiler"

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"]
      }
    })
  ],
})