import { useEffect } from 'react'
import axios from 'axios'
import { Routes, Route, Navigate } from 'react-router-dom'
import ChatPage from './page/chat'
import SharePage from './page/share'
import '@/style/app.scss'
function App() {
  useEffect(() => {
    axios.get('https://httpbin.org/get').catch(() => {})
  }, [])

  return (
    <div className="app">
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/share/:token" element={<SharePage />} />
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </div>
  )
}

export default App
