import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Modal, Form, Input, Radio, Button, Avatar, Slider, Upload, message } from 'antd'
import { PlusOutlined, LoadingOutlined, UserOutlined, BgColorsOutlined } from '@ant-design/icons'
import '@/style/settingModal.scss'

const themeOptions = [
  { key: 'light', label: '浅色', desc: '明亮简洁，适合白天使用' },
  { key: 'dark', label: '深色', desc: '沉浸专注，适合夜间使用' },
  { key: 'system', label: '跟随系统', desc: '自动匹配系统外观模式' },
]

export default function SettingModal({
  open,
  onCancel,
  userInfo,
  themeMode = 'system',
  onSaveUser,
  onChangeTheme,
}) {
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [initialProfile, setInitialProfile] = useState({
    nickname: '',
    gender: 'unknown',
    avatar: '',
  })
  const [avatar, setAvatar] = useState('')
  const [cropOpen, setCropOpen] = useState(false)
  const [cropImage, setCropImage] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedPixels, setCroppedPixels] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [form] = Form.useForm()
  const tabs = [
    {
      key: 'profile',
      title: '用户设置',
      desc: '头像、昵称和性别',
      icon: <UserOutlined />,
    },
    {
      key: 'preferences',
      title: '偏好设置',
      desc: '界面主题与展示风格',
      icon: <BgColorsOutlined />,
    },
  ]

  useEffect(() => {
    if (!open) return
    const nextInitial = {
      nickname: (userInfo?.nickname || userInfo?.username || '').trim(),
      gender: userInfo?.gender || 'unknown',
      avatar: userInfo?.avatar || '',
    }
    form.setFieldsValue({
      nickname: nextInitial.nickname,
      gender: nextInitial.gender,
    })
    setInitialProfile(nextInitial)
    setAvatar(nextInitial.avatar)
    setActiveTab('profile')
  }, [form, open, userInfo])

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.setAttribute('crossOrigin', 'anonymous')
      image.src = url
    })

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc)
    const maxSize = 512
    const scale = Math.min(1, maxSize / Math.max(pixelCrop.width, pixelCrop.height))
    const targetWidth = Math.max(1, Math.round(pixelCrop.width * scale))
    const targetHeight = Math.max(1, Math.round(pixelCrop.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      targetWidth,
      targetHeight,
    )
    return canvas.toDataURL('image/jpeg', 0.86)
  }

  const hasProfileDirty = useCallback(() => {
    const values = form.getFieldsValue(['nickname', 'gender'])
    const current = {
      nickname: (values?.nickname || '').trim(),
      gender: values?.gender || 'unknown',
      avatar: avatar || '',
    }
    return (
      current.nickname !== (initialProfile.nickname || '') ||
      current.gender !== (initialProfile.gender || 'unknown') ||
      current.avatar !== (initialProfile.avatar || '')
    )
  }, [avatar, form, initialProfile])

  const confirmLeaveIfDirty = useCallback(
    (onConfirm) => {
      if (activeTab === 'profile' && hasProfileDirty()) {
        Modal.confirm({
          title: '有未保存的修改',
          content: '当前更改尚未保存，确认离开吗？',
          okText: '离开',
          cancelText: '继续编辑',
          onOk: onConfirm,
        })
        return
      }
      onConfirm?.()
    },
    [activeTab, hasProfileDirty],
  )

  const handleModalCancel = () => {
    confirmLeaveIfDirty(() => onCancel?.())
  }

  const handleSwitchTab = (nextTab) => {
    if (nextTab === activeTab) return
    confirmLeaveIfDirty(() => setActiveTab(nextTab))
  }

  const handleSaveProfile = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const normalized = {
        nickname: (values.nickname || '').trim(),
        gender: values.gender || 'unknown',
        avatar: avatar || '',
      }
      await onSaveUser?.(normalized)
      setInitialProfile(normalized)
      message.success('用户设置已保存')
      onCancel?.()
    } finally {
      setSaving(false)
    }
  }

  const openCropForFile = (file, onProgress) =>
    new Promise((resolve, reject) => {
    if (!file) {
      resolve()
      return
    }
    if (!file.type.startsWith('image/')) {
      message.warning('请上传图片文件')
      reject(new Error('invalid file type'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      message.warning('图片大小不能超过 5MB')
      reject(new Error('file too large'))
      return
    }
    setUploading(true)
    setUploadPercent(0)
    const reader = new FileReader()
    reader.onprogress = (event) => {
      if (!event.lengthComputable) return
      const percent = Math.min(99, Math.round((event.loaded / event.total) * 100))
      setUploadPercent(percent)
      onProgress?.({ percent })
    }
    reader.onerror = () => {
      setUploading(false)
      reject(new Error('read failed'))
    }
    reader.onload = () => {
      setCropImage(String(reader.result || ''))
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCropOpen(true)
      setUploadPercent(100)
      onProgress?.({ percent: 100 })
      setTimeout(() => {
        setUploading(false)
      }, 180)
      resolve()
    }
    reader.readAsDataURL(file)
  })

  const handleCustomUpload = async ({ file, onProgress, onSuccess, onError }) => {
    try {
      await openCropForFile(file, onProgress)
      onSuccess?.({}, file)
    } catch (err) {
      onError?.(err)
    }
  }

  const handleConfirmCrop = async () => {
    if (!cropImage || !croppedPixels) return
    const cropped = await getCroppedImg(cropImage, croppedPixels)
    setAvatar(cropped)
    setCropOpen(false)
  }

  return (
    <Modal
      open={open}
      onCancel={handleModalCancel}
      footer={null}
      width={820}
      title={null}
      destroyOnClose
      className="setting-modal"
    >
      <div className="setting-modal-body">
        <div className="setting-modal-nav">
          <div className="setting-modal-nav-head">
            <h4>设置中心</h4>
            <p>管理账号信息与界面偏好</p>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'active' : ''}
              onClick={() => handleSwitchTab(tab.key)}
            >
              <span className="setting-modal-nav-icon">{tab.icon}</span>
              <span className="setting-modal-nav-text">
                <strong>{tab.title}</strong>
                <small>{tab.desc}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="setting-modal-panel">
          {activeTab === 'profile' ? (
            <>
              <h3>用户设置</h3>
              <p className="setting-panel-subtitle">保持信息完整，便于在会话中识别你的身份</p>
              <Form
                form={form}
                layout="vertical"
                requiredMark={false}
                className="setting-profile-form"
              >
                <Form.Item label="头像">
                  <div className="setting-avatar-row">
                    <Upload
                      accept="image/*"
                      showUploadList={false}
                      maxCount={1}
                      customRequest={handleCustomUpload}
                    >
                      <button
                        type="button"
                        className={`setting-avatar-upload-trigger ${uploading ? 'is-uploading' : ''}`}
                      >
                        <Avatar src={avatar || undefined} size={84}>
                          {uploading ? (
                            <span className="setting-avatar-progress">{uploadPercent}%</span>
                          ) : avatar ? (
                            (form.getFieldValue('nickname') || 'U').slice(0, 1)
                          ) : (
                            <PlusOutlined />
                          )}
                        </Avatar>
                        {uploading && (
                          <span className="setting-avatar-loading-icon">
                            <LoadingOutlined />
                          </span>
                        )}
                        <span className="setting-avatar-hover-mask">更换头像</span>
                      </button>
                    </Upload>
                    <div className="setting-avatar-actions">
                      <div className="setting-avatar-action-row">
                        <span className="setting-avatar-action-title">点击圆形头像上传</span>
                        {avatar && (
                          <Button
                            size="small"
                            type="link"
                            onClick={() => setAvatar('')}
                          >
                            移除
                          </Button>
                        )}
                      </div>
                      <small className="setting-upload-tip">支持 PNG / JPG / WEBP，最大 5MB</small>
                    </div>
                  </div>
                </Form.Item>
                <Form.Item
                  label="昵称"
                  name="nickname"
                  rules={[{ required: true, message: '请输入昵称' }]}
                >
                  <Input maxLength={30} placeholder="请输入昵称" />
                </Form.Item>
                <Form.Item label="性别" name="gender">
                  <Radio.Group>
                    <Radio value="male">男</Radio>
                    <Radio value="female">女</Radio>
                    <Radio value="unknown">保密</Radio>
                  </Radio.Group>
                </Form.Item>
              </Form>
              <div className="setting-actions">
                <Button onClick={handleModalCancel}>取消</Button>
                <Button type="primary" loading={saving} onClick={handleSaveProfile}>
                  保存
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3>偏好设置</h3>
              <p className="setting-panel-subtitle">选择你喜欢的外观模式，主题会立即生效</p>
              <div className="setting-theme-grid">
                {themeOptions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`setting-theme-card ${themeMode === item.key ? 'active' : ''}`}
                    onClick={() => onChangeTheme?.(item.key)}
                  >
                    <div className="setting-theme-preview" data-mode={item.key} />
                    <span>{item.label}</span>
                    <small>{item.desc}</small>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <Modal
        open={cropOpen}
        title="裁剪头像"
        onCancel={() => setCropOpen(false)}
        onOk={handleConfirmCrop}
        okText="确认"
        cancelText="取消"
        width={560}
        className="setting-crop-modal"
      >
        <div className="setting-crop-area">
          <Cropper
            image={cropImage}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setCroppedPixels(pixels)}
          />
        </div>
        <div className="setting-crop-zoom">
          <span>缩放</span>
          <Slider min={1} max={3} step={0.1} value={zoom} onChange={setZoom} />
        </div>
      </Modal>
    </Modal>
  )
}

