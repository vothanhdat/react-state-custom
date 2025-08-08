# React State Custom Library

React State Custom is a TypeScript React library that provides custom state management utilities and hooks. It's built with Vite, uses Yarn with Plug'n'Play (PnP), and exports ES modules and UMD bundles for distribution.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites and Setup
- Enable Corepack first: `corepack enable`
- This project requires Yarn 4.6.0 and uses Plug'n'Play (PnP) for dependency management
- Node.js v20+ is recommended (tested with v20.19.4)

### Bootstrap, Build, and Test the Repository
1. **Install dependencies**:
   ```bash
   yarn install
   ```
   - Takes ~30-35 seconds. NEVER CANCEL. Set timeout to 60+ minutes if needed.
   - Downloads and installs ~243 packages with PnP

2. **Build the library**:
   ```bash
   yarn build
   ```
   - Takes ~5-6 seconds. NEVER CANCEL. Set timeout to 30+ minutes for safety.
   - Creates `dist/index.es.js`, `dist/index.umd.js`, and `dist/index.d.ts`
   - Includes TypeScript declaration files via vite-plugin-dts

3. **TypeScript checking**:
   ```bash
   yarn tsc --noEmit
   ```
   - Takes ~2 seconds. Validates TypeScript without emitting files.

4. **Run tests**:
   ```bash
   yarn test
   ```
   - Currently outputs "No tests specified" and exits with code 0
   - Takes <1 second

### Development Server
- **Start development server**:
  ```bash
  yarn dev
  ```
  - Starts Vite dev server on http://localhost:3000/
  - Takes ~3 seconds to start. NEVER CANCEL.
  - This is a library project, so there's no HTML entry point to serve

### VS Code + Yarn PnP Setup
- **Fix VS Code TypeScript integration**:
  ```bash
  bash fix-vscode-yarn-pnp.sh
  ```
  - Takes ~25-30 seconds. NEVER CANCEL. Set timeout to 60+ minutes.
  - Installs Yarn SDKs and configures VS Code settings
  - Creates `.yarn/sdks/typescript/` and updates `.vscode/settings.json`
  - Must reload VS Code after running

## Validation
- Always validate builds by checking that `dist/` directory contains:
  - `index.es.js` (~35KB)
  - `index.umd.js` (~25KB) 
  - `index.d.ts` (TypeScript definitions)
- Always run `yarn tsc --noEmit` to validate TypeScript before committing
- The library exports state management utilities: `Context`, `getContext`, `useDataContext`, `createRootCtx`, `AutoRootCtx`, `createAutoCtx`, `useQuickSubscribe`
- UMD build requires React environment; ES module is recommended for consumption

## Common Tasks

### Available Scripts
```bash
yarn run          # List all available scripts
```
Available scripts:
- `build`: 'vite build'
- `dev`: 'vite'  
- `test`: 'echo "No tests specified" && exit 0'

### Project Structure
```
├── src/
│   ├── index.ts              # Main library exports
│   ├── components/
│   │   └── MyComponent.tsx   # Example React component
│   └── state-utils/          # Core state management utilities
│       ├── ctx.ts           # Context class and hooks
│       ├── createRootCtx.tsx
│       ├── createAutoCtx.tsx
│       ├── useQuickSubscribe.ts
│       ├── useQuickSubscribeV2.ts
│       └── useRefValue.ts
├── dist/                     # Build output (generated)
├── package.json              # Dependencies and scripts
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
├── fix-vscode-yarn-pnp.sh   # VS Code setup script
└── .yarnrc.yml              # Yarn PnP configuration
```

### Key Configuration Files

#### package.json
```json
{
  "name": "react-state-custom",
  "version": "1.0.8",
  "type": "module",
  "main": "dist/index.umd.js",
  "module": "dist/index.es.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "echo \"No tests specified\" && exit 0"
  }
}
```

#### .yarnrc.yml
```yaml
nodeLinker: pnp
```

### Dependencies
- **Runtime**: events, lodash-es, react-object-view-bigint, vite-plugin-dts
- **Dev**: @types/*, @vitejs/plugin-react, react, react-dom, typescript, vite
- **Package Manager**: yarn@4.6.0 (managed via Corepack)

## Critical Workflow Notes
- **NEVER CANCEL**: Build may take up to 35 seconds, dependency installation up to 35 seconds, VS Code setup up to 30 seconds
- Always run `corepack enable` before any yarn commands on fresh clone
- Always run the VS Code setup script when working in VS Code with this repository
- Always validate TypeScript with `yarn tsc --noEmit` before committing
- The library uses Yarn PnP - dependencies are not in `node_modules` but managed via `.pnp.cjs`
- Built files in `dist/` should be committed for distribution

## State Management Library Usage
The library exports these key utilities:
- `Context<D>`: Generic context class for managing shared state
- `createRootCtx()`: Creates root context with state management
- `createAutoCtx()`: Creates auto-managed context
- `useDataContext()`, `useDataSource()`, `useQuickSubscribe()`: React hooks for state subscription
- `AutoRootCtx`: Component for automatic context management

## Troubleshooting
- If VS Code shows TypeScript errors, run `bash fix-vscode-yarn-pnp.sh` and reload VS Code
- If yarn commands fail, ensure Corepack is enabled: `corepack enable`
- If builds fail, check that all dependencies are installed with `yarn install`
- Library requires React environment for runtime usage (React 19+ in devDependencies)