# My React Library

This is a simple React library created using Yarn, Vite, and TypeScript. It includes a sample component that can be used in your React applications.

## Installation

To install the library, you can use Yarn:

```bash
yarn add my-react-library
```

## Usage

To use the `MyComponent` in your React application, you can import it as follows:

```tsx
import { MyComponent } from 'my-react-library';

const App = () => {
  return (
    <div>
      <MyComponent propName="value" />
    </div>
  );
};

export default App;
```

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