import { defineConfig } from 'vitepress'

const repo = 'https://github.com/vothanhdat/react-state-custom'

export default defineConfig({
  title: 'react-state-custom',
  description: 'Turn any React hook into a shared store. No boilerplate, automatic lifecycle, selective re-renders.',
  base: '/react-state-custom/docs/',
  outDir: '../demo-dist/docs',
  lastUpdated: false,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/react-state-custom/docs/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'API', link: '/api/create-store', activeMatch: '/api/' },
      { text: 'Benchmarks', link: '/benchmarks' },
      { text: 'Changelog', link: '/changelog' },
      { text: 'Demo', link: 'https://vothanhdat.github.io/react-state-custom/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Start',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'How it works', link: '/guide/how-it-works' },
          ],
        },
        {
          text: 'Stores',
          items: [
            { text: 'Store options', link: '/guide/store-options' },
            { text: 'Parameterized stores', link: '/guide/parameterized-stores' },
            { text: 'Composing stores', link: '/guide/composing-stores' },
            { text: 'Scopes', link: '/guide/scopes' },
            { text: 'Error handling', link: '/guide/error-handling' },
          ],
        },
        {
          text: 'Reading state',
          items: [
            { text: 'Selectors', link: '/guide/selectors' },
            { text: 'Suspense', link: '/guide/suspense' },
            { text: 'Outside React', link: '/guide/outside-react' },
            { text: 'Reads outside render', link: '/guide/reads-outside-render' },
          ],
        },
        {
          text: 'Integration',
          items: [
            { text: 'Developer tools', link: '/guide/devtools' },
            { text: 'Server-side rendering', link: '/guide/ssr' },
            { text: 'React Compiler', link: '/guide/react-compiler' },
            { text: 'Testing', link: '/guide/testing' },
            { text: 'Limitations and FAQ', link: '/guide/limitations' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Primary API',
          items: [
            { text: 'createStore', link: '/api/create-store' },
            { text: 'AutoRootCtx', link: '/api/auto-root-ctx' },
            { text: 'StateScopeProvider', link: '/api/state-scope-provider' },
            { text: 'StoreErrorBoundary', link: '/api/store-error-boundary' },
            { text: 'Types', link: '/api/types' },
          ],
        },
        {
          text: 'Other entries',
          items: [
            { text: 'Developer tools', link: '/api/dev-tools' },
            { text: 'Primitives', link: '/api/primitives' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/master/docs/:path`, text: 'Edit this page on GitHub' },
    search: { provider: 'local' },
    outline: [2, 3],
    footer: { message: 'Released under the MIT License.', copyright: 'Copyright © Vo Thanh Dat' },
  },
  markdown: { lineNumbers: false },
})
