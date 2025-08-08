# React State Custom

A powerful React library for advanced state management with context-based data sharing, automatic subscriptions, and efficient re-rendering optimization.

## Installation

```bash
npm install react-state-custom
# or
yarn add react-state-custom
```

## Quick Start

```tsx
import { useDataContext, useDataSource, useDataSubscribe } from 'react-state-custom';

interface AppData {
  counter: number;
  userName: string;
}

const DataProvider: React.FC = () => {
  const ctx = useDataContext<AppData>('app-context');
  useDataSource(ctx, 'counter', 0);
  useDataSource(ctx, 'userName', 'John Doe');
  return null;
};

const DataConsumer: React.FC = () => {
  const ctx = useDataContext<AppData>('app-context');
  const counter = useDataSubscribe(ctx, 'counter');
  const userName = useDataSubscribe(ctx, 'userName');
  
  return (
    <div>
      <p>Counter: {counter}</p>
      <p>User: {userName}</p>
    </div>
  );
};
```

## Features

- 🔄 **Reactive State Management**: Automatic subscription and re-rendering
- 🎯 **Type-Safe**: Full TypeScript support with generic types
- ⚡ **Performance Optimized**: Debouncing, throttling, and smart subscriptions
- 🏗️ **Auto Context Management**: Automatic mounting/unmounting of contexts
- 🔧 **Flexible**: Works with any data structure and use case

## Documentation

For comprehensive documentation including all exported functions, examples, and best practices, see [DOCUMENTATION.md](./DOCUMENTATION.md).

## Main Exports

- **Context Management**: `Context`, `getContext`, `useDataContext`
- **Data Sources**: `useDataSource`, `useDataSourceMultiple` 
- **Subscriptions**: `useDataSubscribe`, `useDataSubscribeMultiple`, `useDataSubscribeWithTransform`
- **Root Context**: `createRootCtx`
- **Auto Context**: `AutoRootCtx`, `createAutoCtx`
- **Advanced**: `useQuickSubscribe`

## Development

To start developing the library, clone the repository and install the dependencies:

```bash
git clone <repository-url>
cd my-react-library
yarn install
```

To run the development server, use:

```bash
yarn dev
```

## Building

To build the library for production, run:

```bash
yarn build
```

## License

This project is licensed under the MIT License. See the LICENSE file for more details.