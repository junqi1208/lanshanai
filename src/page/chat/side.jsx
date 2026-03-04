import { Conversations } from '@ant-design/x'
import { Button, Avatar, Dropdown, Input, Modal, message } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  LogoutOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import logo from '@/assets/images/logo.png'
import '@/style/side.scss'

export default function ChatSide(props) {
  const {
    collapsed,
    items = [],
    selectedKey,
    onSelect,
    onCreateNew,
    onRename,
    onDelete,
    onOpenSettings,
    onLogout,
    footerUser,
  } = props

  const openRenameModal = (conversation) => {
    let nextTitle = conversation?.label || ''
    Modal.confirm({
      title: '重命名会话',
      okText: '保存',
      cancelText: '取消',
      content: (
        <Input
          autoFocus
          maxLength={120}
          defaultValue={nextTitle}
          placeholder="请输入会话名称"
          onChange={(e) => {
            nextTitle = e.target.value
          }}
        />
      ),
      onOk: async () => {
        const title = (nextTitle || '').trim()
        if (!title) {
          message.warning('会话名称不能为空')
          return Promise.reject(new Error('会话名称不能为空'))
        }
        if (title === (conversation?.label || '').trim()) {
          return
        }
        await onRename?.(conversation.key, title)
      },
    })
  }

  const openDeleteModal = (conversation) => {
    Modal.confirm({
      title: '确认删除该会话？',
      content: '删除后将无法恢复，该会话下的所有消息会被一并清除。',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        await onDelete?.(conversation.key)
      },
    })
  }

  const menuConfig = (conversation) => ({
    items: [
      {
        label: '重命名',
        key: 'rename',
        icon: <EditOutlined />,
      },
      {
        type: 'divider',
      },
      {
        label: '删除',
        key: 'delete',
        icon: <DeleteOutlined />,
        danger: true,
      },
    ],
    onClick: (itemInfo) => {
      itemInfo.domEvent.stopPropagation()
      if (itemInfo.key === 'rename') {
        openRenameModal(conversation)
      }
      if (itemInfo.key === 'delete') {
        openDeleteModal(conversation)
      }
    },
  })

  const footerMenu = {
    items: [
      {
        key: 'preferences',
        label: '系统设置',
        icon: <SettingOutlined />,
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        danger: true,
      },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent?.stopPropagation?.()
      if (key === 'preferences') {
        onOpenSettings?.()
        return
      }
      if (key === 'logout') {
        Modal.confirm({
          title: '确认退出登录？',
          content: '退出后需要重新登录才能继续使用。',
          okText: '确认退出',
          cancelText: '取消',
          okType: 'danger',
          onOk: async () => {
            await onLogout?.()
          },
        })
      }
    },
  }

  return (
    <div className='chat-side'>
      <div className="chat-side-header">
        <div className="chat-side-header-title">
          <img src={logo} alt="logo" />
          { 
            collapsed ? null : <span>览山Ai</span>
          }
        </div> 
      </div>
      <div className='chat-side-add'>
        <Button
          type="primary"
          className='chat-side-add-button'
          onClick={() => onCreateNew?.()}
        >
          <PlusOutlined />
          <span>新建对话</span>
        </Button>
      </div>
      <div className='chat-side-list'>
        <Conversations
          menu={menuConfig}
          items={items}
          groupable
          activeKey={selectedKey}
          onActiveChange={(key) => onSelect?.(key)}
          style={{ width: '100%' }}
        />
      </div>
      <div className='chat-side-footer'>
        <div className='chat-side-footer-avatar'>
          <Avatar src={footerUser?.avatar || undefined}>
            {(footerUser?.username || 'U').slice(0, 1)}
          </Avatar>
          <span>{footerUser?.username || '用户名'}</span>
        </div>
        <Dropdown menu={footerMenu} trigger={['click']} placement="topRight">
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      </div>
    </div>
  )
}