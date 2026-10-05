import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { SiteLogosProvider } from './contexts/SiteLogos'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SiteLogosProvider><App /></SiteLogosProvider>
    </BrowserRouter>
  </React.StrictMode>
)
