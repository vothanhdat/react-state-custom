# React Compiler

The library works with the React Compiler. Components and store hooks compiled by `babel-plugin-react-compiler` are covered by a dedicated test run (`yarn test:compiler`) in CI, including helpers that take the whole `useStore()` object.

## What the compiler changes

The compiler memoizes work on the identity of its inputs. The proxy returned by `useStore` is therefore a **new object on every render**, over one subscription tracker per component. With a long-lived proxy, a helper called with the whole object (`describe(store)`) would be cached forever and the keys it reads would stop being tracked; the component would never update. A fresh object each render keeps every read observable, and the compiler still memoizes on the primitive values read out of it.

## Rules

- Never use the proxy's identity as a dependency. Use the values you read from it.
- Reads during render are tracked wherever they happen, including inside compiled helpers called from render.
- Store hooks compile like any other hook. Actions returned by the hook already have stable identities, so compiled consumers memoize correctly on them.

## Enabling the compiler in your app

Follow the React Compiler installation guide for your bundler. No library-specific configuration is needed. The repository's own test setup is a reference:

```ts
// vitest.config.compiler.ts
react({
  babel: { plugins: [['babel-plugin-react-compiler', { target: '19' }]] },
})
```
