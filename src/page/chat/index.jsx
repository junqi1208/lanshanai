import { Layout, Avatar, Typography, ConfigProvider, theme as antdTheme, message, notification, Checkbox, Button, Modal, Switch, Drawer, Grid, Input } from 'antd'
import { Actions, Bubble, CodeHighlighter, Sender } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { RedoOutlined, CopyOutlined, SendOutlined, PauseOutlined } from '@ant-design/icons'
import copy from 'copy-to-clipboard'
import ChatSide from './side'
import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
const { Content, Sider } = Layout
import SvgIcon from '../../components/svgIcon'
import useThemeMode from '@/hooks/useThemeMode'
import '@/style/chat.scss'
import { clearToken, getToken, setToken } from '@/api/token'
import { login, me, register, updateMe } from '@/api/auth'
import { askStream, summarizeConversationTitle } from '@/api/ai'
import { createShareLink } from '@/api/share'
import BotAvatar from '@/assets/images/bot-256.png'
import {
  addMessage,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  updateConversation,
} from '@/api/conversations'


const CONVERSATION_PAGE_SIZE = 20
const SHARE_FEATURE_VISIBLE = true
const LoginModal = lazy(() => import('../../components/loginModal'))
const SettingModal = lazy(() => import('../../components/settingModal'))

const sortConversations = (list = []) =>
  [...list].sort((a, b) => {
    const pinDiff = Number(Boolean(b?.isPinned)) - Number(Boolean(a?.isPinned))
    if (pinDiff !== 0) return pinDiff
    const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime()
    const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime()
    return bTime - aTime
  })

const mergeConversations = (base = [], incoming = []) => {
  const map = new Map()
  base.forEach((item) => {
    map.set(item.id, item)
  })
  incoming.forEach((item) => {
    map.set(item.id, { ...(map.get(item.id) || {}), ...item })
  })
  return sortConversations(Array.from(map.values()))
}

const MarkdownBubbleContent = memo(function MarkdownBubbleContent({ content, renderContent }) {
  return <Typography>{renderContent(content)}</Typography>
})

function ChatPage() {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const listRef = useRef(null)
  const streamAbortRef = useRef(null)
  const streamTextBufferRef = useRef('')
  const streamReasoningBufferRef = useRef('')
  const streamFlushTimerRef = useRef(null)
  const activeStreamMetaRef = useRef({ conversationId: '', localAiId: '', paused: false })
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSideOpen, setMobileSideOpen] = useState(false)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [deepThinking, setDeepThinking] = useState(false)
  const [reasoningExpandedMap, setReasoningExpandedMap] = useState({})
  const [loginOpen, setLoginOpen] = useState(() => !getToken())
  const [settingOpen, setSettingOpen] = useState(false)
  const { themeMode, resolvedTheme, applyThemeMode } = useThemeMode()
  const [currentUser, setCurrentUser] = useState(null)

  const [conversations, setConversations] = useState([])
  const [conversationPage, setConversationPage] = useState(1)
  const [conversationHasMore, setConversationHasMore] = useState(false)
  const [conversationLoadingMore, setConversationLoadingMore] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState('')
  const [chatList, setChatList] = useState([])
  const [shareMode, setShareMode] = useState(false)
  const [selectedShareGroupIds, setSelectedShareGroupIds] = useState([])
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareCreating, setShareCreating] = useState(false)
  const [shareResultOpen, setShareResultOpen] = useState(false)
  const [shareResultLink, setShareResultLink] = useState('')
  const [shareAutoCopied, setShareAutoCopied] = useState(false)

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

  useEffect(() => {
    if (!isMobile) {
      setMobileSideOpen(false)
    }
  }, [isMobile])

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

    return sortConversations(conversations).map((c) => ({
      key: c.id,
      label: c.title || '未命名会话',
      isPinned: !!c.isPinned,
      group: c.isPinned ? '置顶' : getGroupLabel(c.updatedAt),
    }))
  }, [conversations])

  const ensureConversation = useCallback(async () => {
    if (activeConversationId) return activeConversationId
    const conv = await createConversation({})
    setConversations((prev) => sortConversations([conv, ...prev]))
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
        reasoning: item.reasoning || '',
        loading: !!item.loading,
        typing: item.streaming ? { effect: 'fade-in', step: 3 } : false,
        retryPrompt: isAi ? latestUserPrompt : '',
      }
    })
  }, [chatList])

  const shareRows = useMemo(() => {
    let currentGroupId = ''
    return chatList.map((item, index) => {
      const rowId = item.id || `msg_${index}`
      if (item.type === 'user') {
        currentGroupId = `u_${rowId}`
      } else if (!currentGroupId) {
        currentGroupId = `m_${rowId}`
      }
      return {
        id: rowId,
        groupId: currentGroupId,
        role: item.type === 'user' ? 'user' : 'assistant',
        content: item.message,
      }
    })
  }, [chatList])

  const shareGroupIds = useMemo(() => {
    const set = new Set()
    shareRows.forEach((row) => set.add(row.groupId))
    return Array.from(set)
  }, [shareRows])

  const selectedShareCount = selectedShareGroupIds.length

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

  const clearStreamFlushTimer = useCallback(() => {
    if (!streamFlushTimerRef.current) return
    clearTimeout(streamFlushTimerRef.current)
    streamFlushTimerRef.current = null
  }, [])

  const applyStreamBuffersToMessage = useCallback((localAiId, options = {}) => {
    const { finish = false } = options
    const nextText = streamTextBufferRef.current
    const nextReasoning = streamReasoningBufferRef.current
    setChatList((prev) => {
      const targetIdx = prev.findIndex((msg) => msg.id === localAiId)
      if (targetIdx < 0) return prev
      const next = [...prev]
      next[targetIdx] = {
        ...next[targetIdx],
        message: nextText,
        reasoning: nextReasoning,
        streaming: !finish,
        loading: false,
      }
      return next
    })
  }, [])

  const scheduleStreamFlush = useCallback((localAiId) => {
    if (streamFlushTimerRef.current) return
    streamFlushTimerRef.current = setTimeout(() => {
      streamFlushTimerRef.current = null
      applyStreamBuffersToMessage(localAiId, { finish: false })
    }, 80)
  }, [applyStreamBuffersToMessage])

  const refreshMeAndConvs = async () => {
    const [u, convRes] = await Promise.all([
      me(),
      listConversations({ page: 1, pageSize: CONVERSATION_PAGE_SIZE }),
    ])
    const sortedConvs = sortConversations(convRes?.items || [])
    setCurrentUser(u)
    setConversations(sortedConvs)
    setConversationPage(1)
    setConversationHasMore(Boolean(convRes?.hasMore))
    if (!activeConversationId && sortedConvs?.[0]?.id) {
      setActiveConversationId(sortedConvs[0].id)
    }
  }

  const loadMoreConversations = useCallback(async () => {
    if (conversationLoadingMore || !conversationHasMore) return
    const nextPage = conversationPage + 1
    setConversationLoadingMore(true)
    try {
      const convRes = await listConversations({
        page: nextPage,
        pageSize: CONVERSATION_PAGE_SIZE,
      })
      const nextItems = convRes?.items || []
      setConversations((prev) => mergeConversations(prev, nextItems))
      setConversationPage(nextPage)
      setConversationHasMore(Boolean(convRes?.hasMore))
    } finally {
      setConversationLoadingMore(false)
    }
  }, [conversationHasMore, conversationLoadingMore, conversationPage])

  const handleSideListScroll = useCallback((event) => {
    const target = event?.currentTarget
    if (!target || conversationLoadingMore || !conversationHasMore) return
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight
    if (distanceToBottom <= 40) {
      loadMoreConversations().catch((e) => {
        message.error(e?.response?.data?.message || '加载更多会话失败')
      })
    }
  }, [conversationHasMore, conversationLoadingMore, loadMoreConversations])

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
        reasoning: m.reasoning || '',
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

  const pauseCurrentStreamingAnswer = useCallback(async () => {
    const { conversationId, localAiId, paused } = activeStreamMetaRef.current
    if (!conversationId || !localAiId || paused) return
    activeStreamMetaRef.current = { conversationId, localAiId, paused: true }
    clearStreamFlushTimer()
    applyStreamBuffersToMessage(localAiId, { finish: true })
    const partialAnswer = String(streamTextBufferRef.current || '').trim()
    const partialReasoning = String(streamReasoningBufferRef.current || '').trim()
    if (partialAnswer) {
      await addMessage(conversationId, {
        role: 'assistant',
        content: partialAnswer,
        reasoning: partialReasoning || undefined,
      })
    }
    await maybeGenerateConversationTitle(conversationId)
  }, [applyStreamBuffersToMessage, clearStreamFlushTimer, maybeGenerateConversationTitle])

  const handleStopSending = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort()
      streamAbortRef.current = null
    }
    pauseCurrentStreamingAnswer().catch(() => {
      message.error('暂停回答失败')
    })
    setLoading(false)
    message.info('已暂停回答')
  }, [pauseCurrentStreamingAnswer])

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
        { id: localAiId, type: 'bot', message: '', reasoning: '', streaming: true, loading: true },
      ])
      if (clearInput) setValue('')
      scrollToBottom()

      try {
        const cid = await ensureConversation()
        const abortController = new AbortController()
        streamAbortRef.current = abortController
        streamTextBufferRef.current = ''
        streamReasoningBufferRef.current = ''
        activeStreamMetaRef.current = { conversationId: cid, localAiId, paused: false }

        await askStream(
          { conversationId: cid, prompt: trimmed, deepThinking },
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
              streamTextBufferRef.current += delta
              scheduleStreamFlush(localAiId)
            },
            onReasoning: (delta) => {
              streamReasoningBufferRef.current += delta
              scheduleStreamFlush(localAiId)
            },
            onDone: () => {
              clearStreamFlushTimer()
              applyStreamBuffersToMessage(localAiId, { finish: true })
              maybeGenerateConversationTitle(cid)
            },
            onError: (errMsg) => {
              clearStreamFlushTimer()
              throw new Error(errMsg || '流式请求失败')
            },
          },
        )

        if (!conversations.find((c) => c.id === cid)) {
          const convRes = await listConversations({ page: 1, pageSize: CONVERSATION_PAGE_SIZE })
          setConversations(sortConversations(convRes?.items || []))
          setConversationPage(1)
          setConversationHasMore(Boolean(convRes?.hasMore))
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
        clearStreamFlushTimer()
        streamAbortRef.current = null
        streamTextBufferRef.current = ''
        streamReasoningBufferRef.current = ''
        activeStreamMetaRef.current = { conversationId: '', localAiId: '', paused: false }
        setLoading(false)
      }
    },
    [
      activeConversationId,
      applyStreamBuffersToMessage,
      clearStreamFlushTimer,
      deepThinking,
      conversations,
      ensureConversation,
      loading,
      maybeGenerateConversationTitle,
      scheduleStreamFlush,
      scrollToBottom,
    ],
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
    () => [
      {
        key: 'copyText',
        icon: <CopyOutlined />,
        label: '复制',
      },
      {
        key: 'retry',
        icon: <RedoOutlined />,
        label: '重新回答',
      },
    ],
    [],
  )

  const toggleShareGroup = useCallback((groupId, checked) => {
    if (!groupId) return
    setSelectedShareGroupIds((prev) => {
      const has = prev.includes(groupId)
      if (checked && !has) return [...prev, groupId]
      if (!checked && has) return prev.filter((id) => id !== groupId)
      return prev
    })
  }, [])

  const toggleReasoningExpanded = useCallback((messageKey) => {
    if (!messageKey) return
    setReasoningExpandedMap((prev) => ({
      ...prev,
      [messageKey]: !(prev[messageKey] ?? true),
    }))
  }, [])

  const handleSelectAllShare = useCallback(() => {
    if (!shareGroupIds.length) return
    if (selectedShareGroupIds.length === shareGroupIds.length) {
      setSelectedShareGroupIds([])
      return
    }
    setSelectedShareGroupIds(shareGroupIds)
  }, [selectedShareGroupIds.length, shareGroupIds])

  const exitShareMode = useCallback(() => {
    setShareMode(false)
    setSelectedShareGroupIds([])
    setShareModalOpen(false)
  }, [])

  const copyTextSafely = useCallback((text) => {
    const value = String(text || '')
    if (!value) return false

    if (window.isSecureContext && navigator?.clipboard?.writeText) {
      // 在安全上下文里也统一走插件，保持行为一致
    }

    return copy(value)
  }, [])

  const copyShareLink = useCallback(async () => {
    if (!activeConversationId) {
      message.warning('当前会话不可分享')
      return
    }
    if (!selectedShareGroupIds.length) {
      message.warning('请至少选择一组对话')
      return
    }
    setShareCreating(true)
    try {
      const res = await createShareLink({
        conversationId: activeConversationId,
        groupIds: selectedShareGroupIds,
      })
      const sharePath = String(res?.sharePath || '').trim()
      if (!sharePath) {
        message.error('创建分享链接失败：返回链接为空')
        return
      }
      const shareLink = /^https?:\/\//.test(sharePath)
        ? sharePath
        : `${window.location.origin}${sharePath}`

      const copied = copyTextSafely(shareLink)
      setShareResultLink(shareLink)
      setShareAutoCopied(copied)
      setShareResultOpen(true)
      setShareModalOpen(false)
      if (copied) {
        message.success('分享链接已创建并复制')
      } else {
        message.warning('分享链接已创建，请手动复制')
      }
    } catch (e) {
      message.error(e?.response?.data?.message || '创建分享链接失败')
    } finally {
      setShareCreating(false)
    }
  }, [activeConversationId, copyTextSafely, selectedShareGroupIds])

  const handleCopyShareResultLink = useCallback(() => {
    const copied = copyTextSafely(shareResultLink)
    if (copied) {
      message.success('链接已复制')
      return
    }
    message.error('复制失败，请手动选择复制')
  }, [copyTextSafely, shareResultLink])

  const bubbleRoles = useMemo(
    () => ({
      ai: (data) => ({
        placement: 'start',
        avatar: () => <Avatar className="chat-main-avatar" src={BotAvatar} />,
        typing: data.typing || false,
        contentRender: (content) => {
          const hasReasoning = !!String(data.reasoning || '').trim()
          const msgKey = String(data?.key || '')
          const expanded = reasoningExpandedMap[msgKey] ?? true
          return (
            <div className="chat-ai-content-wrap">
              {hasReasoning ? (
                <div className="chat-ai-reasoning">
                  <div className="chat-ai-reasoning-head">
                    <div className="chat-ai-reasoning-title-wrap">
                      <span className="chat-ai-reasoning-dot" />
                      <div className="chat-ai-reasoning-title">深度思考</div>
                      <div className="chat-ai-reasoning-subtitle">以下内容为模型推理过程</div>
                    </div>
                    <Button
                      type="link"
                      size="small"
                      className="chat-ai-reasoning-toggle"
                      onClick={() => toggleReasoningExpanded(msgKey)}
                    >
                      {expanded ? '收起' : '展开'}
                    </Button>
                  </div>
                  {expanded ? <div className="chat-ai-reasoning-body">{data.reasoning}</div> : null}
                </div>
              ) : null}
              <MarkdownBubbleContent content={content} renderContent={renderMarkdownWithCodeHighlighter} />
            </div>
          )
        },
        footer: (content) => (shareMode ? null : (
          <Actions
            items={actionItems()}
            onClick={async (payload) => {
              const actionKey = typeof payload === 'string' ? payload : payload?.key
              if (actionKey === 'copyText') {
                const copied = copyTextSafely(String(content || ''))
                if (copied) {
                  message.success('已复制')
                } else {
                  message.error('复制失败')
                }
              }
              if (actionKey === 'retry') {
                handleRetryQuestion(data.retryPrompt)
              }
            }}
          />
        )),
      }),
      user: {
        placement: 'end',
        avatar: () => <Avatar className="chat-main-avatar">我</Avatar>,
        typing: false,
      },
    }),
    [actionItems, copyTextSafely, handleRetryQuestion, reasoningExpandedMap, renderMarkdownWithCodeHighlighter, shareMode, toggleReasoningExpanded],
  )

  useEffect(() => {
    const handler = () => {
      setCurrentUser(null)
      setConversations([])
      setConversationPage(1)
      setConversationHasMore(false)
      setConversationLoadingMore(false)
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
    setShareMode(false)
    setSelectedShareGroupIds([])
    setShareModalOpen(false)
    setReasoningExpandedMap({})
    loadConversationMessages(activeConversationId).catch((e) => {
      message.error(e?.response?.data?.message || '加载会话失败')
    })
  }, [activeConversationId, loadConversationMessages])

  useEffect(() => {
    if (!chatList.length) return
    scrollToBottom()
  }, [chatList.length, scrollToBottom])

  useEffect(() => {
    return () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort()
        streamAbortRef.current = null
      }
      clearStreamFlushTimer()
    }
  }, [clearStreamFlushTimer])

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout style={{ height: '100%' }}>
      {isMobile ? (
        <Drawer
          open={mobileSideOpen}
          placement="left"
          onClose={() => setMobileSideOpen(false)}
          title={null}
          closable={false}
          width="82vw"
          styles={{
            header: {
              display: 'none',
            },
            body: {
              padding: 0,
              backgroundColor: 'var(--app-sider-bg)',
            },
            content: {
              backgroundColor: 'var(--app-sider-bg)',
            },
          }}
        >
          <ChatSide
            collapsed={false}
            items={sideItems}
            hasMore={conversationHasMore}
            loadingMore={conversationLoadingMore}
            onListScroll={handleSideListScroll}
            selectedKey={activeConversationId}
            onSelect={async (id) => {
              setActiveConversationId(id)
              setMobileSideOpen(false)
            }}
            onCreateNew={async () => {
              try {
                const conv = await createConversation({})
                setConversations((prev) => sortConversations([conv, ...prev]))
                setActiveConversationId(conv.id)
                setMobileSideOpen(false)
              } catch (e) {
                message.error(e?.response?.data?.message || '新建对话失败')
              }
            }}
            onRename={async (id, title) => {
              try {
                const updated = await updateConversation(id, { title })
                setConversations((prev) =>
                  sortConversations(prev.map((c) => (c.id === id ? { ...c, ...updated } : c))),
                )
                message.success('重命名成功')
              } catch (e) {
                message.error(e?.response?.data?.message || '重命名失败')
              }
            }}
            onTogglePin={async (id, isPinned) => {
              try {
                const updated = await updateConversation(id, { isPinned })
                setConversations((prev) =>
                  sortConversations(prev.map((c) => (c.id === id ? { ...c, ...updated } : c))),
                )
                message.success(isPinned ? '置顶成功' : '已取消置顶')
              } catch (e) {
                message.error(e?.response?.data?.message || '置顶操作失败')
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
        </Drawer>
      ) : (
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
            hasMore={conversationHasMore}
            loadingMore={conversationLoadingMore}
            onListScroll={handleSideListScroll}
            selectedKey={activeConversationId}
            onSelect={async (id) => {
              setActiveConversationId(id)
            }}
            onCreateNew={async () => {
              try {
                const conv = await createConversation({})
                setConversations((prev) => sortConversations([conv, ...prev]))
                setActiveConversationId(conv.id)
              } catch (e) {
                message.error(e?.response?.data?.message || '新建对话失败')
              }
            }}
            onRename={async (id, title) => {
              try {
                const updated = await updateConversation(id, { title })
                setConversations((prev) =>
                  sortConversations(prev.map((c) => (c.id === id ? { ...c, ...updated } : c))),
                )
                message.success('重命名成功')
              } catch (e) {
                message.error(e?.response?.data?.message || '重命名失败')
              }
            }}
            onTogglePin={async (id, isPinned) => {
              try {
                const updated = await updateConversation(id, { isPinned })
                setConversations((prev) =>
                  sortConversations(prev.map((c) => (c.id === id ? { ...c, ...updated } : c))),
                )
                message.success(isPinned ? '置顶成功' : '已取消置顶')
              } catch (e) {
                message.error(e?.response?.data?.message || '置顶操作失败')
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
      )}
      <Content style={{ backgroundColor: 'var(--app-content-bg)', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <div className='chat-main'>
          <div className='chat-main-header'>
            {isMobile ? (
              <Button
                className='chat-main-menu-btn'
                type="text"
                icon={<SvgIcon name={'collapse'} size={18} />}
                onClick={() => setMobileSideOpen(true)}
              />
            ) : null}
            <div className='chat-main-title'>{activeTitle}</div>
            {SHARE_FEATURE_VISIBLE ? (
              <div className='chat-main-share'>
                <Button
                  type="text"
                  icon={<SvgIcon name={'share'} size={18}></SvgIcon>}
                  onClick={() => {
                    if (!chatList.length) {
                      message.warning('当前会话暂无可分享内容')
                      return
                    }
                    setShareMode(true)
                    setSelectedShareGroupIds([])
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className='chat-main-content'>
            {shareMode ? (
              <div className='chat-main-share-select-list'>
                {shareRows.map((row) => {
                  const checked = selectedShareGroupIds.includes(row.groupId)
                  return (
                    <div
                      key={row.id}
                      className={`chat-main-share-select-row ${row.role === 'user' ? 'is-user' : 'is-assistant'}`}
                    >
                      <div className='chat-main-share-check-col'>
                        <Checkbox
                          checked={checked}
                          onChange={(e) => toggleShareGroup(row.groupId, e.target.checked)}
                        />
                      </div>
                      <div className='chat-main-share-bubble-col'>
                        <div
                          className={`chat-main-share-bubble ${row.role === 'user' ? 'is-user' : 'is-assistant'}`}
                          onClick={() => toggleShareGroup(row.groupId, !checked)}
                        >
                          <Typography>{renderMarkdownWithCodeHighlighter(row.content)}</Typography>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Bubble.List
                ref={listRef}
                items={bubbleItems}
                role={bubbleRoles}
                style={{ height: '100%', scrollBehavior: 'smooth' }}
              />
            )}
          </div>
          <div className='chat-main-footer'>
            {shareMode ? (
              <div className='chat-main-share-footer'>
                <div className='chat-main-share-footer-left'>
                  <Button type="link" onClick={handleSelectAllShare}>
                    {selectedShareCount === shareGroupIds.length && shareGroupIds.length > 0 ? '取消全选' : '全选'}
                  </Button>
                  <span>已选择{selectedShareCount}组对话</span>
                </div>
                <div className='chat-main-share-footer-right'>
                  <Button onClick={exitShareMode}>取消</Button>
                  <Button
                    type="primary"
                    disabled={!selectedShareCount}
                    onClick={() => setShareModalOpen(true)}
                  >
                    创建分享链接
                  </Button>
                </div>
              </div>
            ) : (
              <div className='chat-main-sender-wrap'>
                <div className='chat-main-tools-inside'>
                  <div className={`chat-main-thinking-card ${deepThinking ? 'is-active' : ''}`}>
                    <div className='chat-main-thinking-texts'>
                      <span className='chat-main-thinking-title'>深度思考</span>
                    </div>
                    <Switch
                      className='chat-main-thinking-switch'
                      size="small"
                      checked={deepThinking}
                      onChange={(checked) => setDeepThinking(checked)}
                    />
                  </div>
                  <Button
                    size="small"
                    type={loading ? 'default' : 'primary'}
                    className={`chat-main-send-action ${loading ? 'is-stop' : 'is-send'}`}
                    icon={loading ? <PauseOutlined /> : <SendOutlined />}
                    aria-label={loading ? '停止' : '发送'}
                    onClick={async () => {
                      if (loading) {
                        handleStopSending()
                        return
                      }
                      await submitQuestion(value, { clearInput: true })
                    }}
                  />
                </div>
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
                  onCancel={handleStopSending}
                  autoSize={{ minRows: 3, maxRows: 6 }}
                />
              </div>
            )}
          </div>
        </div>
        <Modal
          title="创建分享链接"
          open={shareModalOpen}
          onCancel={() => setShareModalOpen(false)}
          footer={[
            <Button key="cancel" onClick={() => setShareModalOpen(false)}>
              取消
            </Button>,
            <Button
              key="create"
              type="primary"
              loading={shareCreating}
              onClick={copyShareLink}
            >
              创建并复制
            </Button>,
          ]}
        >
          <p>将基于当前选择的 {selectedShareCount} 组问答创建分享链接。</p>
        </Modal>
        <Modal
          title="分享链接已创建"
          open={shareResultOpen}
          onCancel={() => setShareResultOpen(false)}
          footer={[
            <Button key="close" onClick={() => setShareResultOpen(false)}>
              我知道了
            </Button>,
            <Button key="copy" type="primary" onClick={handleCopyShareResultLink}>
              复制链接
            </Button>,
          ]}
        >
          <Typography.Paragraph style={{ marginBottom: 12 }}>
            {shareAutoCopied ? '已自动复制到剪贴板，可直接粘贴使用。' : '自动复制失败，请手动复制下方链接。'}
          </Typography.Paragraph>
          <Input
            value={shareResultLink}
            readOnly
            onFocus={(e) => e.target.select()}
          />
        </Modal>
        {loginOpen ? (
          <Suspense fallback={null}>
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
          </Suspense>
        ) : null}
        {settingOpen ? (
          <Suspense fallback={null}>
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
          </Suspense>
        ) : null}
      </Content>
      </Layout>
    </ConfigProvider>
  )
}

export default ChatPage
