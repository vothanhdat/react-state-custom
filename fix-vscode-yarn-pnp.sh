#!/bin/bash
# Fix VS Code + Yarn PnP TypeScript/module resolution issues

# 1. Set Yarn to use Plug'n'Play (PnP)
yarn config set nodeLinker pnp

# 2. Install dependencies
yarn install

# 3. Install Yarn SDKs for editor support
yarn dlx @yarnpkg/sdks vscode

# 4. Create VS Code settings for TypeScript SDK
mkdir -p .vscode
cat > .vscode/settings.json <<EOL
{
  "typescript.tsdk": ".yarn/sdks/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "search.exclude": {
    "**/.yarn": true,
    "**/.pnp.*": true
  }
}
EOL

echo "VS Code + Yarn PnP fix complete! Reload VS Code for changes to take effect."
