import { createRoot } from 'react-dom/client'
import { Playground } from './examples/Playground'
import "react-obj-view/dist/react-obj-view.css"


createRoot(document.getElementById('root')!)
  .render(<Playground />)
