import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'virtual:svg-icons-register'
import './index.css'
import 'antd/dist/reset.css'
import { preloadLoginBackground } from './utils/preloadLoginBackground'
import App from './App.jsx'

preloadLoginBackground()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
