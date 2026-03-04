import { useEffect } from 'react'
import axios from 'axios'
import { Routes, Route, Navigate } from 'react-router-dom'
import ChatPage from './page/chat'
import '@/style/app.scss'
function App() {
  useEffect(() => {
    axios.get('https://httpbin.org/get').catch(() => {})
  }, [])

  return (
    <div className="app">
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </div>
  )
}

export default App
