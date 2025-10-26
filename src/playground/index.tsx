import { createRoot } from 'react-dom/client'
import { Playground } from './Playground'
import "react-obj-view/dist/react-obj-view.css"
import '../examples/examples.css'


createRoot(document.getElementById('root')!)
  .render(<Playground />)
