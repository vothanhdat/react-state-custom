# React State Custom Library

React State Custom is a React state management library built with Yarn PnP, Vite, and TypeScript. It provides custom hooks, context-based state sharing, and event-driven subscriptions for React applications.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Initial Setup
- **CRITICAL**: Enable corepack first: `corepack enable`
- Install dependencies: `yarn install` -- takes 30 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- Build the library: `yarn build` -- takes 6 seconds. NEVER CANCEL. Set timeout to 30+ seconds.

### Development Commands
- **Dependencies**: `corepack enable && yarn install`
- **Build**: `yarn build` -- produces ES modules, UMD bundles, and TypeScript declarations
- **Development server**: `yarn dev` -- starts Vite dev server on port 3000 (for library development)
- **Tests**: `yarn test` -- currently returns "No tests specified" (no test suite exists)

### Build Process
The build process creates multiple output formats in the `dist/` directory:
- `index.es.js` - ES module build (~35KB)
- `index.umd.js` - UMD build (~25KB) 
- `index.d.ts` - TypeScript declarations
- Compiled components and state-utils subdirectories

### VS Code Setup for Yarn PnP
This project uses Yarn Plug'n'Play (PnP). For proper VS Code integration:
- Run the provided script: `./fix-vscode-yarn-pnp.sh`
- Or manually install Yarn SDKs: `yarn dlx @yarnpkg/sdks vscode`
- Reload VS Code after setup

## Validation

### Build Validation
Always validate that your changes don't break the build:
1. Run `yarn build` to ensure the library compiles successfully
2. Check that output files exist in `dist/`: `index.es.js`, `index.umd.js`, `index.d.ts`
3. Verify TypeScript compilation: `npx tsc --noEmit` (may show React import warnings, this is expected)

### Library Export Validation
Test that the main exports are accessible:
```javascript
// The library exports these main functions:
import { 
  Context, 
  useDataContext, 
  createRootCtx, 
  useQuickSubscribe 
} from 'react-state-custom';
```

### Manual Testing Scenarios
For any changes to the state management logic:
1. **Build validation**: Run `yarn build` and verify all output files are generated
2. **Export validation**: Check that main exports are available in `dist/index.d.ts`
3. **Module format validation**: Ensure both ES (`index.es.js`) and UMD (`index.umd.js`) builds exist
4. **Development server**: Run `yarn dev` and verify it starts without errors on port 3000
5. **TypeScript compilation**: Run `npx tsc --noEmit` to check for type errors (React warnings are expected)

### Automated Validation Script
Run this validation to verify the library is built correctly:
```bash
# Create a simple validation script
cat > /tmp/validate.js << 'EOF'
const fs = require('fs');
const files = ['dist/index.es.js', 'dist/index.umd.js', 'dist/index.d.ts'];
files.forEach(f => {
  if (fs.existsSync(f)) console.log(`✅ ${f}`);
  else { console.log(`❌ ${f}`); process.exit(1); }
});
console.log('🎉 Build validation passed');
EOF

node /tmp/validate.js
```

## Repository Structure

### Key Directories
- `/src/` - Source code
  - `/src/index.ts` - Main library exports
  - `/src/state-utils/` - Core state management utilities
  - `/src/components/` - Sample React components
- `/dist/` - Build output (generated)
- `/.yarn/` - Yarn PnP cache and SDKs

### Important Files
- `package.json` - Dependencies and scripts (uses Yarn 4.6.0)
- `vite.config.ts` - Build configuration for library bundling
- `tsconfig.json` - TypeScript compiler configuration  
- `.yarnrc.yml` - Yarn PnP configuration
- `fix-vscode-yarn-pnp.sh` - VS Code setup script

### Core State Management Files
- `src/state-utils/ctx.ts` - Main Context class and hooks
- `src/state-utils/createRootCtx.tsx` - Root context creation utilities
- `src/state-utils/useQuickSubscribeV2.ts` - Quick subscription hook
- `src/state-utils/createAutoCtx.tsx` - Auto context utilities

## Common Tasks

### Adding New State Utilities
When adding new state management features:
1. Add the implementation to `/src/state-utils/`
2. Export from `/src/index.ts`
3. Run `yarn build` to verify compilation
4. Test the new functionality works with existing hooks

### Debugging State Issues
For state management debugging:
1. Check the Context class implementation in `src/state-utils/ctx.ts`
2. Verify event subscription logic in the useData* hooks
3. Use console logging in the Context constructor (already present)
4. Test with the development server: `yarn dev`

### Library Maintenance
- Always run `yarn build` before committing changes
- Verify that TypeScript definitions are generated correctly
- Check that both ES and UMD builds are created
- Ensure no runtime errors in the built output

## Technology Stack

### Build Tools
- **Vite 6.3.5** - Build tool and development server
- **TypeScript 5.8.3** - Type checking and compilation
- **vite-plugin-dts** - TypeScript declaration generation

### Package Manager
- **Yarn 4.6.0** - Uses Plug'n'Play (PnP) mode
- **Corepack** - Required for correct Yarn version management

### React Integration
- **React 19** - Peer dependency for hooks and components
- **@vitejs/plugin-react** - React support in Vite

### Dependencies
- **events** - EventEmitter for state subscriptions
- **lodash-es** - Utility functions (debounce, throttle, memoize)
- **react-object-view-bigint** - Object viewing utilities

## Common Command Outputs

The following are outputs from frequently run commands. Reference them instead of viewing, searching, or running bash commands to save time.

### Repository Root Structure
```
ls -la
.git
.gitignore
.vscode/
.yarn/
.yarnrc.yml
README.md
dist/
fix-vscode-yarn-pnp.sh
package.json
src/
tsconfig.json
vite.config.ts
yarn.lock
```

### Source Directory Structure  
```
ls -la src/
components/
  MyComponent.tsx
index.ts
state-utils/
  createAutoCtx.tsx
  createRootCtx.tsx
  ctx.ts
  useQuickSubscribe.ts
  useQuickSubscribeV2.ts
  useRefValue.ts
```

### Build Output Structure
```
ls -la dist/
components/
index.d.ts
index.es.js    (~34KB)
index.umd.js   (~25KB)
state-utils/
```

### Package.json Scripts
```json
{
  "scripts": {
    "build": "vite build",
    "dev": "vite", 
    "test": "echo \"No tests specified\" && exit 0"
  }
}
```

## Troubleshooting

### Yarn Version Issues
If you see "packageManager" version conflicts:
- Run `corepack enable` to use the correct Yarn version
- The project requires Yarn 4.6.0, not the global system version

### VS Code TypeScript Issues
If VS Code shows TypeScript errors:
- Run `./fix-vscode-yarn-pnp.sh` to configure Yarn PnP SDKs
- Reload VS Code window after SDK installation
- Check that `.vscode/settings.json` points to the Yarn TypeScript SDK

### Build Failures
If builds fail:
- Ensure all dependencies are installed: `yarn install`
- Check for TypeScript errors: `npx tsc --noEmit`
- Verify Vite configuration in `vite.config.ts`

### Missing React Types
React import warnings during TypeScript compilation are expected since React is a dev dependency. The library builds correctly despite these warnings.