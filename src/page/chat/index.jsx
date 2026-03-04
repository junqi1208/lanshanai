import { Layout, Avatar, Typography, ConfigProvider, theme as antdTheme, message, notification } from 'antd'
import { Actions, Bubble, CodeHighlighter, Sender } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { RedoOutlined } from '@ant-design/icons'
import ChatSide from './side'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
const { Content, Sider } = Layout
import SvgIcon from '../../components/svgIcon'
import LoginModal from '../../components/loginModal'
import SettingModal from '../../components/settingModal'
import useThemeMode from '@/hooks/useThemeMode'
import '@/style/chat.scss'
import { clearToken, getToken, setToken } from '@/api/token'
import { login, me, register, updateMe } from '@/api/auth'
import { askStream, summarizeConversationTitle } from '@/api/ai'
import BotAvatar from '@/assets/images/bot.png'
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  updateConversation,
} from '@/api/conversations'


function ChatPage() {
  const listRef = useRef(null)
  const streamAbortRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginOpen, setLoginOpen] = useState(() => !getToken())
  const [settingOpen, setSettingOpen] = useState(false)
  const { themeMode, resolvedTheme, applyThemeMode } = useThemeMode()
  const [currentUser, setCurrentUser] = useState(null)

  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState('')
  const [chatList, setChatList] = useState([])

  const renderMarkdownWithCodeHighlighter = useCallback((content) => {
    const source = String(content || '')
    const blockRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g
    const nodes = []
    let lastIndex = 0
    let match = blockRegex.exec(source)
    let key = 0

    while (match) {
      const [full, langRaw, code] = match
      const start = match.index

      if (start > lastIndex) {
        const mdPart = source.slice(lastIndex, start)
        if (mdPart.trim()) {
          nodes.push(
            <XMarkdown key={`md_${key++}`} content={mdPart} />,
          )
        }
      }

      const lang = (langRaw || 'plaintext').toLowerCase()
      nodes.push(
        <div className="chat-code-block" key={`code_${key++}`}>
          <CodeHighlighter lang={lang}>{code}</CodeHighlighter>
        </div>,
      )

      lastIndex = start + full.length
      match = blockRegex.exec(source)
    }

    const tail = source.slice(lastIndex)
    if (tail.trim() || nodes.length === 0) {
      nodes.push(
        <XMarkdown key={`md_${key++}`} content={tail} />,
      )
    }

    return <div className="chat-markdown-content">{nodes}</div>
  }, [])

  const triggerEle = (
    <SvgIcon
      name={'collapse'}
      style={{
        transition: 'transform 0.6s',
        transform: `rotate(${collapsed ? 0 : 180}deg)`,
      }}
    />
  )

  const activeTitle = useMemo(() => {
    const found = conversations.find((c) => c.id === activeConversationId)
    return found?.title || '新对话'
  }, [activeConversationId, conversations])

  const sideItems = useMemo(() => {
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const formatDate = (d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const getGroupLabel = (timeValue) => {
      if (!timeValue) return '更早'
      const target = new Date(timeValue)
      if (Number.isNaN(target.getTime())) return '更早'
      const now = new Date()
      const diffMs = startOfDay(now).getTime() - startOfDay(target).getTime()
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
      if (diffDays <= 0) return '今天'
      if (diffDays === 1) return '昨天'
      if (diffDays <= 7) return '7天前'
      if (diffDays <= 30) return '30天内'
      return formatDate(target)
    }

    return conversations.map((c) => ({
      key: c.id,
      label: c.title || '未命名会话',
      group: getGroupLabel(c.updatedAt),
    }))
  }, [conversations])

  const ensureConversation = useCallback(async () => {
    if (activeConversationId) return activeConversationId
    const conv = await createConversation({})
    setConversations((prev) => [conv, ...prev])
    setActiveConversationId(conv.id)
    return conv.id
  }, [activeConversationId])

  const bubbleItems = useMemo(() => {
    let latestUserPrompt = ''
    return chatList.map((item, index) => {
      if (item.type === 'user') {
        latestUserPrompt = item.message
      }
      const isAi = item.type !== 'user'
      return {
        key: item.id || `msg_${index}`,
        role: item.type === 'user' ? 'user' : 'ai',
        content: item.message,
        loading: !!item.loading,
        typing: item.streaming ? { effect: 'fade-in', step: 3 } : false,
        retryPrompt: isAi ? latestUserPrompt : '',
      }
    })
  }, [chatList])

  const antdThemeConfig = useMemo(
    () => ({
      algorithm: resolvedTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 10,
      },
      components: {
        Modal: {
          borderRadiusLG: 16,
        },
      },
    }),
    [resolvedTheme],
  )

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 'bottom', behavior })
    })
  }, [])

  const refreshMeAndConvs = async () => {
    const [u, convs] = await Promise.all([me(), listConversations()])
    setCurrentUser(u)
    setConversations(convs)
    if (!activeConversationId && convs?.[0]?.id) {
      setActiveConversationId(convs[0].id)
    }
  }

  const loadConversationMessages = useCallback(async (conversationId) => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
    }
    setLoading(false)
    const msgs = await listMessages(conversationId)
    setChatList(
      msgs.map((m) => ({
        id: m.id,
        type: m.role === 'user' ? 'user' : 'bot',
        message: m.content,
        streaming: false,
      })),
    )
    scrollToBottom('auto')
  }, [scrollToBottom])

  const maybeGenerateConversationTitle = useCallback(
    async (conversationId) => {
      if (!conversationId) return
      const existing = conversations.find((c) => c.id === conversationId)
      if (existing?.title?.trim()) return
      try {
        const result = await summarizeConversationTitle({ conversationId })
        const nextTitle = (result?.title || '').trim()
        if (!nextTitle) return
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: nextTitle } : c)),
        )
      } catch {
        // 标题生成失败不影响主流程
      }
    },
    [conversations],
  )

  const submitQuestion = useCallback(
    async (rawPrompt, options = {}) => {
      const { clearInput = false } = options
      const trimmed = String(rawPrompt || '').trim()
      if (!trimmed) return
      if (!getToken()) {
        setLoginOpen(true)
        return
      }
      if (loading) {
        message.warning('请等待当前回答完成')
        return
      }

      setLoading(true)
      const localUserMsg = { id: `local_u_${Date.now()}`, type: 'user', message: trimmed }
      const localAiId = `local_a_${Date.now()}`
      setChatList((prev) => [
        ...prev,
        localUserMsg,
        { id: localAiId, type: 'bot', message: '', streaming: true, loading: true },
      ])
      if (clearInput) setValue('')
      scrollToBottom()

      try {
        const cid = await ensureConversation()
        const abortController = new AbortController()
        streamAbortRef.current = abortController
        let generated = ''

        await askStream(
          { conversationId: cid, prompt: trimmed },
          {
            signal: abortController.signal,
            onStart: (payload) => {
              if (
                payload?.conversationId &&
                payload.conversationId !== activeConversationId
              ) {
                setActiveConversationId(payload.conversationId)
              }
            },
            onDelta: (delta) => {
              generated += delta
              setChatList((prev) =>
                prev.map((msg) =>
                  msg.id === localAiId
                    ? { ...msg, message: generated, streaming: true, loading: false }
                    : msg,
                ),
              )
            },
            onDone: () => {
              setChatList((prev) =>
                prev.map((msg) =>
                  msg.id === localAiId ? { ...msg, streaming: false, loading: false } : msg,
                ),
              )
              maybeGenerateConversationTitle(cid)
            },
            onError: (errMsg) => {
              throw new Error(errMsg || '流式请求失败')
            },
          },
        )

        if (!conversations.find((c) => c.id === cid)) {
          const convs = await listConversations()
          setConversations(convs)
        }
      } catch (e) {
        const errMsg = e?.name === 'AbortError' ? '已取消发送' : e?.message || e?.response?.data?.message || '发送失败'
        setChatList((prev) =>
          prev.map((msg) =>
            msg.id.startsWith('local_a_') && msg.streaming
              ? { ...msg, streaming: false, loading: false }
              : msg,
          ),
        )
        if (e?.name !== 'AbortError') {
          message.error(errMsg)
        }
      } finally {
        streamAbortRef.current = null
        setLoading(false)
      }
    },
    [activeConversationId, conversations, ensureConversation, loading, maybeGenerateConversationTitle, scrollToBottom],
  )

  const handleRetryQuestion = useCallback(async (retryPrompt) => {
    const nextPrompt = String(retryPrompt || '').trim()
    if (!nextPrompt) {
      message.warning('未找到对应问题，无法重新回答')
      return
    }
    await submitQuestion(nextPrompt)
  }, [submitQuestion])

  const actionItems = useCallback(
    (content) => [
      {
        key: 'copy',
        label: '复制',
        actionRender: () => {
          return <Actions.Copy text={content} />
        },
      },
      {
        key: 'retry',
        icon: <RedoOutlined />,
        label: '重新回答',
      },
    ],
    [],
  )

  const bubbleRoles = useMemo(
    () => ({
      ai: (data) => ({
        placement: 'start',
        avatar: () => <Avatar className="chat-main-avatar" src={BotAvatar} />,
        typing: data.typing || false,
        contentRender: (content) => <Typography>{renderMarkdownWithCodeHighlighter(content)}</Typography>,
        footer: (content) => (
          <Actions
            items={actionItems(content)}
            onClick={(payload) => {
              const actionKey = typeof payload === 'string' ? payload : payload?.key
              if (actionKey === 'retry') {
                handleRetryQuestion(data.retryPrompt)
              }
            }}
          />
        ),
      }),
      user: {
        placement: 'end',
        avatar: () => <Avatar className="chat-main-avatar">我</Avatar>,
        typing: false,
      },
    }),
    [actionItems, handleRetryQuestion, renderMarkdownWithCodeHighlighter],
  )

  useEffect(() => {
    const handler = () => {
      setCurrentUser(null)
      setConversations([])
      setActiveConversationId('')
      setChatList([])
      setLoginOpen(true)
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [])

  useEffect(() => {
    if (!getToken()) {
      setLoginOpen(true)
      return
    }
    refreshMeAndConvs().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeConversationId) return
    loadConversationMessages(activeConversationId).catch((e) => {
      message.error(e?.response?.data?.message || '加载会话失败')
    })
  }, [activeConversationId, loadConversationMessages])

  useEffect(() => {
    if (!chatList.length) return
    scrollToBottom()
  }, [chatList.length, scrollToBottom])

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout style={{ height: '100%' }}>
      <Sider
        width={280}
        style={{ height: '100%', backgroundColor: 'var(--app-sider-bg)' }}
        collapsible
        trigger={triggerEle}
        collapsed={collapsed}
        collapsedWidth={0}
        onCollapse={() => {
          setCollapsed(!collapsed)
        }}
      >
        <ChatSide
          collapsed={collapsed}
          items={sideItems}
          selectedKey={activeConversationId}
          onSelect={async (id) => {
            setActiveConversationId(id)
          }}
          onCreateNew={async () => {
            try {
              const conv = await createConversation({})
              setConversations((prev) => [conv, ...prev])
              setActiveConversationId(conv.id)
            } catch (e) {
              message.error(e?.response?.data?.message || '新建对话失败')
            }
          }}
          onRename={async (id, title) => {
            try {
              const updated = await updateConversation(id, { title })
              setConversations((prev) =>
                prev.map((c) => (c.id === id ? { ...c, ...updated } : c)),
              )
              message.success('重命名成功')
            } catch (e) {
              message.error(e?.response?.data?.message || '重命名失败')
            }
          }}
          onDelete={async (id) => {
            try {
              await deleteConversation(id)
              setConversations((prev) => {
                const next = prev.filter((c) => c.id !== id)
                if (activeConversationId === id) {
                  const nextActiveId = next[0]?.id || ''
                  setActiveConversationId(nextActiveId)
                  if (!nextActiveId) {
                    setChatList([])
                  }
                }
                return next
              })
              message.success('删除成功')
            } catch (e) {
              message.error(e?.response?.data?.message || '删除失败')
            }
          }}
          footerUser={{
            username: currentUser?.nickname || currentUser?.username || '未登录',
            avatar: currentUser?.avatar,
          }}
          onLogout={async () => {
            clearToken()
            window.dispatchEvent(new CustomEvent('auth:logout'))
            message.success('已退出登录')
          }}
          onOpenSettings={() => setSettingOpen(true)}
        />
      </Sider>
      <Content style={{ backgroundColor: 'var(--app-content-bg)', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <div className='chat-main'>
          <div className='chat-main-header'>
            <div className='chat-main-title'>{activeTitle}</div>
            <div className='chat-main-share'>
              <SvgIcon name={'share'} size={18}></SvgIcon>
            </div>
          </div>
          <div className='chat-main-content'>
            <Bubble.List
              ref={listRef}
              items={bubbleItems}
              role={bubbleRoles}
              style={{ height: '100%', scrollBehavior: 'smooth' }}
            />
          </div>
          <div className='chat-main-footer'>
            <Sender
              loading={loading}
              value={value}
              placeholder="请输入你的问题，按 Enter 发送"
              onChange={(v) => {
                setValue(v)
              }}
              onSubmit={async () => {
                await submitQuestion(value, { clearInput: true })
              }}
              onCancel={() => {
                if (streamAbortRef.current) {
                  streamAbortRef.current.abort()
                  streamAbortRef.current = null
                }
                setChatList((prev) =>
                  prev.map((msg) =>
                    msg.id.startsWith('local_a_') && msg.streaming
                      ? { ...msg, streaming: false, loading: false }
                      : msg,
                  ),
                )
                setLoading(false)
                message.error('已取消发送')
              }}
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </div>
        </div>
        <LoginModal
          open={loginOpen}
          onCancel={() => {
            if (!getToken()) return
            setLoginOpen(false)
          }}
          onLogin={async (values) => {
            try {
              const res = await login(values)
              if (!res?.accessToken) return false
              setToken(res.accessToken)
              setLoginOpen(false)
              await refreshMeAndConvs()
              notification.success({
                message: '欢迎回来',
                description: `很高兴再次见到你，${res?.user?.username || values?.username || ''}`,
                placement: 'topRight',
              })
              return true
            } catch (e) {
              message.error(e?.response?.data?.message || '登录失败')
              return false
            }
          }}
          onRegister={async (values) => {
            try {
              const res = await register(values)
              if (!res?.accessToken) return false
              setToken(res.accessToken)
              setLoginOpen(false)
              await refreshMeAndConvs()
              return true
            } catch (e) {
              message.error(e?.response?.data?.message || '注册失败')
              return false
            }
          }}
        />
        <SettingModal
          open={settingOpen}
          onCancel={() => setSettingOpen(false)}
          userInfo={currentUser}
          themeMode={themeMode}
          onChangeTheme={applyThemeMode}
          onSaveUser={async ({ nickname, gender, avatar }) => {
            const updated = await updateMe({ nickname, gender, avatar })
            setCurrentUser(updated)
          }}
        />
      </Content>
      </Layout>
    </ConfigProvider>
  )
}

export default ChatPage
