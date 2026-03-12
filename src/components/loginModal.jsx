import { useState } from 'react'
import { Modal, Form, Input, Button, Typography, Carousel } from 'antd'
import '@/style/loginModal.scss'
import logo from '@/assets/images/logo-256.png'
import { MOUNTAIN_CAROUSEL_ITEMS } from '@/constants/mountainCarousel'
const { Text, Title } = Typography

export default function LoginModal({
  open,
  onCancel,
  onLogin,
  onRegister,
}) {
  const [form] = Form.useForm()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [activeSlide, setActiveSlide] = useState(0)
  const activeItem =
    MOUNTAIN_CAROUSEL_ITEMS[activeSlide] || MOUNTAIN_CAROUSEL_ITEMS[0]

  const handleOk = async () => {
    const values = await form.validateFields()
    try {
      let ok = true
      if (mode === 'login') {
        const res = await onLogin?.(values)
        if (res === false) ok = false
      } else {
        const res = await onRegister?.(values)
        if (res === false) ok = false
      }
      if (!ok) return
    } catch {
      return
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      footer={null}
      centered
      width={800}
      className="login-modal"
      styles={{ body: { height: 480 } }}
      destroyOnClose
    >
      <div className="login-modal-body">
        <div className="login-modal-left">
          <Carousel
            autoplay
            effect="fade"
            autoplaySpeed={3400}
            pauseOnHover={false}
            beforeChange={(_, next) => setActiveSlide(next)}
            className="login-modal-carousel"
          >
            {MOUNTAIN_CAROUSEL_ITEMS.map((item, index) => (
              <div className="login-modal-carousel-item" key={item.src}>
                <img
                  src={item.src}
                  alt={`览山风景 ${index + 1}`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={index === 0 ? 'high' : 'low'}
                />
              </div>
            ))}
          </Carousel>
        </div>
        <div className="login-modal-right">
          <div className="login-panel">
            <div className="login-panel-main">
              <div className="login-panel-top">
                <div className="login-header-logo">
                  <img src={logo} alt="logo" loading="lazy" decoding="async" />
                  <div className="login-brand-text">
                    <span>览山 Ai</span>
                    <Text type="secondary">智能对话与知识助手</Text>
                  </div>
                </div>
                <div className="login-mode-tabs">
                  <button
                    type="button"
                    className={mode === 'login' ? 'active' : ''}
                    onClick={() => setMode('login')}
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    className={mode === 'register' ? 'active' : ''}
                    onClick={() => setMode('register')}
                  >
                    注册
                  </button>
                </div>
              </div>
              <Form
                form={form}
                layout="vertical"
                initialValues={{ username: '', password: '' }}
                onFinish={handleOk}
                requiredMark={false}
              >
                <Form.Item
                  label="账号"
                  name="username"
                  rules={[{ required: true, message: '请输入账号' }]}
                >
                  <Input
                    placeholder="手机号 / 邮箱 / 用户名"
                    size="large"
                  />
                </Form.Item>
                <Form.Item
                  label="密码"
                  name="password"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password
                    placeholder="请输入密码"
                    size="large"
                  />
                </Form.Item>

                <div className="login-form-actions">
                  <Text type="secondary">
                    {mode === 'login'
                      ? '使用账号密码快速登录'
                      : '注册即表示同意服务条款'}
                  </Text>
                  {mode === 'login' && (
                    <Button type="link" size="small" className="login-forgot-btn">
                      忘记密码?
                    </Button>
                  )}
                </div>

                <Form.Item style={{ marginBottom: 10 }}>
                  <Button
                    type="primary"
                    block
                    htmlType="submit"
                    size="large"
                  >
                    {mode === 'login' ? '登录' : '注册'}
                  </Button>
                </Form.Item>
              </Form>
            </div>
            <div className="login-panel-bottom">
              <div key={activeSlide} className="login-mountain-quote">
                <Text type="secondary">“{activeItem?.quote}”</Text>
                <Text type="secondary">—— {activeItem?.author}</Text>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
