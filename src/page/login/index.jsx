import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Form, Input, Button, ConfigProvider, theme as antdTheme, message, notification } from 'antd'
import useThemeMode from '@/hooks/useThemeMode'
import { login, register } from '@/api/auth'
import { getToken, setToken } from '@/api/token'
import { getApiErrorMessage } from '@/utils/getApiErrorMessage'
import '@/style/login.scss'

const LOGIN_EXIT_MS = 520
const LOGIN_ENTER_MS = 560

const getMotionDuration = (duration) => {
  if (typeof window === 'undefined') return duration
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
  return duration
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromLogout = Boolean(location.state?.fromLogout)
  const { resolvedTheme } = useThemeMode()
  const [form] = Form.useForm()
  const [mode, setMode] = useState('login')
  const [submitting, setSubmitting] = useState(false)
  const [cardAnim, setCardAnim] = useState(() => (fromLogout ? 'enter' : 'idle'))
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    if (!fromLogout) return undefined
    const timer = window.setTimeout(() => {
      setCardAnim('idle')
    }, getMotionDuration(LOGIN_ENTER_MS))
    return () => window.clearTimeout(timer)
  }, [fromLogout])

  useEffect(() => {
    if (cardAnim === 'exit') return
    if (getToken()) {
      navigate('/chat', { replace: true })
    }
  }, [cardAnim, navigate])

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      const res = mode === 'login'
        ? await login(values)
        : await register(values)
      if (!res?.accessToken) return
      setToken(res.accessToken)
      if (mode === 'login') {
        notification.success({
          message: '欢迎回来',
          description: `很高兴再次见到你，${res?.user?.username || values?.username || ''}`,
          placement: 'topRight',
        })
      } else {
        message.success('注册成功')
      }
      setCardAnim('exit')
      window.setTimeout(() => {
        navigate('/chat', { replace: true })
      }, getMotionDuration(LOGIN_EXIT_MS))
    } catch (e) {
      message.error(getApiErrorMessage(e, mode === 'login' ? '登录失败' : '注册失败'))
      setSubmitting(false)
    }
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          borderRadius: 10,
          controlHeightLG: 44,
        },
      }}
    >
      <div className={`login-page${isDark ? ' is-dark' : ''}`}>
        <div className="login-page-bg" aria-hidden="true" />
        <div className="login-page-overlay" aria-hidden="true" />

        <main className="login-page-main">
          <div
            className={[
              'login-page-card',
              cardAnim === 'enter' ? 'is-enter' : '',
              cardAnim === 'exit' ? 'is-exit' : '',
            ].filter(Boolean).join(' ')}
          >
            <div className="login-page-card-body">
              <h1 className="login-page-title">览山</h1>

              <div className="login-page-mode" role="tablist" aria-label="登录方式">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={mode === 'login' ? 'is-active' : ''}
                onClick={() => setMode('login')}
              >
                登录
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={mode === 'register' ? 'is-active' : ''}
                onClick={() => setMode('register')}
              >
                注册
              </button>
            </div>

            <Form
              form={form}
              layout="vertical"
              initialValues={{ username: '', password: '' }}
              onFinish={handleSubmit}
              requiredMark={false}
              className="login-page-form"
            >
              <Form.Item
                name="username"
                rules={[{ required: true, message: '请输入账号' }]}
              >
                <Input placeholder="账号" size="large" />
              </Form.Item>
              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="密码" size="large" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  block
                  htmlType="submit"
                  size="large"
                  loading={submitting}
                  className="login-page-submit"
                >
                  {mode === 'login' ? '登录' : '注册'}
                </Button>
              </Form.Item>
              </Form>
            </div>
          </div>
        </main>

        <footer className="login-page-footer">
          <Link to="/about" className="login-page-about-link">
            项目简介
          </Link>
        </footer>
      </div>
    </ConfigProvider>
  )
}
