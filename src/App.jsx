import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import '@/style/app.scss'

const ChatPage = lazy(() => import('./page/chat'))
const SharePage = lazy(() => import('./page/share'))
const LoginPage = lazy(() => import('./page/login'))
const AboutPage = lazy(() => import('./page/about'))

function App() {
  return (
    <div className="app">
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
