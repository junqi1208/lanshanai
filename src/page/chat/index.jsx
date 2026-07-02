import { Layout, Avatar, Typography, ConfigProvider, theme as antdTheme, message, Checkbox, Button, Modal, Drawer, Grid, Input } from 'antd'
import { Actions, Bubble, CodeHighlighter, Sender } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { RedoOutlined, CopyOutlined, SendOutlined, PauseOutlined, PaperClipOutlined } from '@ant-design/icons'
import copy from 'copy-to-clipboard'
import ChatSide from './side'
import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
const { Content, Sider } = Layout
import ChatMessageAttachments, { parseMessageAttachments } from '../../components/chatMessageAttachments'
import { ReplyStyleNeonTrigger, ReplyStylePanel } from '../../components/replyStylePicker'
import ComposerUploadPanel from '../../components/composerUploadPanel'
import { getStoredReplyStyle, storeReplyStyle } from '@/constants/replyStyles'
import ChatModelSelect from '../../components/chatModelSelect'
import {
  getChatModelMeta,
  getStoredChatModel,
  getUploadHintByModel,
  getUploadAcceptByModel,
  isImageAttachment,
  storeChatModel,
  MAX_CHAT_UPLOAD_FILE_SIZE,
  MAX_CHAT_UPLOAD_FILE_COUNT,
} from '@/constants/chatModels'
import SvgIcon from '../../components/svgIcon'
import useThemeMode from '@/hooks/useThemeMode'
import '@/style/chat.scss'
import { clearToken, getToken } from '@/api/token'
import { me, updateMe } from '@/api/auth'
import { askStream, summarizeConversationTitle } from '@/api/ai'
import { deleteFile, uploadFile } from '@/api/files'
import { createShareLink } from '@/api/share'
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  updateConversation,
} from '@/api/conversations'
import {
  EMPTY_HERO_TEXT,
  startEmptyHeroTypewriter as runEmptyHeroTypewriter,
} from '@/utils/emptyHeroTypewriter'
import { getApiErrorMessage } from '@/utils/getApiErrorMessage'

const CONVERSATION_PAGE_SIZE = 20
const SHARE_FEATURE_VISIBLE = true
const COMPOSER_MORPH_MS = 580
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
  const activeConversationIdRef = useRef('')
  const messagesLoadSeqRef = useRef(0)
  const streamPendingRef = useRef(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSideOpen, setMobileSideOpen] = useState(false)
  const [value, setValue] = useState('')
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [replyStyle, setReplyStyle] = useState(() => getStoredReplyStyle())
  const [modelId, setModelId] = useState(() => getStoredChatModel())
  const [composerPanel, setComposerPanel] = useState(null)
  const [stylePanelMounted, setStylePanelMounted] = useState(false)
  const [uploadPanelMounted, setUploadPanelMounted] = useState(false)
  const [reasoningExpandedMap, setReasoningExpandedMap] = useState({})
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
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFileName, setUploadingFileName] = useState('')
  const fileInputRef = useRef(null)
  const pendingFilesRef = useRef([])

  useEffect(() => {
    pendingFilesRef.current = pendingFiles
  }, [pendingFiles])

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

  const handleCreateNew = useCallback(async ({ closeMobileDrawer = false } = {}) => {
    try {
      const conv = await createConversation({})
      setConversations((prev) => sortConversations([conv, ...prev]))
      setActiveConversationId(conv.id)
      if (closeMobileDrawer) {
        setMobileSideOpen(false)
      }
    } catch (e) {
      message.error(getApiErrorMessage(e, '新建对话失败'))
    }
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setMobileSideOpen(false)
    }
  }, [isMobile])

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
    if (activeConversationIdRef.current) return activeConversationIdRef.current
    const conv = await createConversation({})
    setConversations((prev) => sortConversations([conv, ...prev]))
    activeConversationIdRef.current = conv.id
    setActiveConversationId(conv.id)
    return conv.id
  }, [])

  const mapServerMessages = useCallback((msgs) => {
    return (msgs || []).map((m) => ({
      id: m.id,
      type: m.role === 'user' ? 'user' : 'bot',
      message: m.content,
      reasoning: m.reasoning || '',
      attachments: parseMessageAttachments(m.attachments),
      streaming: false,
    }))
  }, [])

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 'bottom', behavior })
    })
  }, [])

  const loadConversationMessages = useCallback(
    async (conversationId, options = {}) => {
      const { force = false } = options
      if (!conversationId) return

      if (!force) {
        if (streamPendingRef.current) return
        if (streamAbortRef.current && activeStreamMetaRef.current.conversationId === conversationId) {
          return
        }
      }

      if (streamAbortRef.current) {
        streamAbortRef.current.abort()
        streamAbortRef.current = null
      }
      setLoading(false)

      const loadSeq = ++messagesLoadSeqRef.current
      try {
        const msgs = await listMessages(conversationId)
        if (loadSeq !== messagesLoadSeqRef.current) return
        if (activeConversationIdRef.current !== conversationId) return
        if (!force && streamAbortRef.current) return

        setChatList(mapServerMessages(msgs))
        scrollToBottom('auto')
      } catch (e) {
        if (loadSeq === messagesLoadSeqRef.current) {
          message.error(getApiErrorMessage(e, '加载会话失败'))
        }
      }
    },
    [mapServerMessages, scrollToBottom],
  )

  const syncMessagesAfterStream = useCallback(
    async (conversationId) => {
      if (!conversationId || streamAbortRef.current) return

      const loadSeq = ++messagesLoadSeqRef.current
      try {
        const msgs = await listMessages(conversationId)
        if (loadSeq !== messagesLoadSeqRef.current) return
        if (activeConversationIdRef.current !== conversationId) return
        if (streamAbortRef.current) return

        setChatList(mapServerMessages(msgs))
      } catch {
        // keep local streamed content if sync fails
      }
    },
    [mapServerMessages],
  )

  const bubbleItems = useMemo(() => {
    return chatList.map((item, index) => {
      return {
        key: item.id || `msg_${index}`,
        role: item.type === 'user' ? 'user' : 'ai',
        content: item.message,
        reasoning: item.reasoning || '',
        loading: !!item.loading,
        typing: item.streaming ? { effect: 'fade-in', step: 3 } : false,
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
        message.error(getApiErrorMessage(e, '加载更多会话失败'))
      })
    }
  }, [conversationHasMore, conversationLoadingMore, loadMoreConversations])

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

  const toggleComposerPanel = useCallback((panel) => {
    setComposerPanel((prev) => (prev === panel ? null : panel))
  }, [])

  const handleOpenUploadPanel = useCallback(() => {
    if (!getToken()) {
      navigate('/login')
      return
    }
    toggleComposerPanel('upload')
  }, [navigate, toggleComposerPanel])

  const handlePickFiles = useCallback(() => {
    if (pendingFilesRef.current.length >= MAX_CHAT_UPLOAD_FILE_COUNT) {
      message.warning(`最多只能上传 ${MAX_CHAT_UPLOAD_FILE_COUNT} 个文件`)
      return
    }
    fileInputRef.current?.click()
  }, [])

  const uploadChatFile = useCallback(async (file, { expectImage = null } = {}) => {
    if (!file) return false

    const lowerName = file.name.toLowerCase()
    const isDoc = lowerName.endsWith('.pdf') || lowerName.endsWith('.docx')
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(lowerName)
    const modelMeta = getChatModelMeta(modelId)

    if (expectImage === true) {
      if (!modelMeta.supportsImage || !isImage) {
        message.warning('请选择常见图片格式')
        return false
      }
    } else if (expectImage === false) {
      if (!isDoc) {
        message.warning('请选择 PDF 或 Word（.docx）文件')
        return false
      }
    } else if (!isDoc && !(modelMeta.supportsImage && isImage)) {
      message.warning(modelMeta.supportsImage ? '仅支持 PDF、Word 或常见图片格式' : '当前模型仅支持 PDF 与 Word（.docx）')
      return false
    }

    if (pendingFilesRef.current.length >= MAX_CHAT_UPLOAD_FILE_COUNT) {
      message.warning(`最多只能上传 ${MAX_CHAT_UPLOAD_FILE_COUNT} 个文件`)
      return false
    }
    if (file.size > MAX_CHAT_UPLOAD_FILE_SIZE) {
      message.warning('文件大小不能超过 5MB')
      return false
    }

    setComposerPanel('upload')
    setUploadingFile(true)
    setUploadProgress(0)
    setUploadingFileName(file.name)
    try {
      const uploaded = await uploadFile(file, setUploadProgress)
      setPendingFiles((prev) => {
        if (prev.length >= MAX_CHAT_UPLOAD_FILE_COUNT) return prev
        const next = [
          ...prev,
          {
            fileId: uploaded.fileId,
            originalName: uploaded.originalName,
            mimeType: uploaded.mimeType,
            charCount: uploaded.charCount,
          },
        ]
        pendingFilesRef.current = next
        return next
      })
      message.success(`已上传：${uploaded.originalName}`)
      return true
    } catch (e) {
      message.error(getApiErrorMessage(e, '文件上传失败'))
      return false
    } finally {
      setUploadingFile(false)
      setUploadProgress(0)
      setUploadingFileName('')
    }
  }, [modelId])

  const handleUploadFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter((item) => item instanceof File)
    if (!files.length) return

    let remaining = MAX_CHAT_UPLOAD_FILE_COUNT - pendingFilesRef.current.length
    if (remaining <= 0) {
      message.warning(`最多只能上传 ${MAX_CHAT_UPLOAD_FILE_COUNT} 个文件`)
      return
    }

    for (const file of files) {
      if (remaining <= 0) {
        message.warning(`最多只能上传 ${MAX_CHAT_UPLOAD_FILE_COUNT} 个文件`)
        break
      }
      const success = await uploadChatFile(file, { expectImage: null })
      if (success) {
        remaining -= 1
      }
    }
  }, [uploadChatFile])

  const handleFileInputChange = useCallback(async (event) => {
    const files = event.target.files
    event.target.value = ''
    if (files?.length) {
      await handleUploadFiles(files)
    }
  }, [handleUploadFiles])

  const handleRemovePendingFile = useCallback(async (fileId) => {
    setPendingFiles((prev) => {
      const next = prev.filter((item) => item.fileId !== fileId)
      pendingFilesRef.current = next
      return next
    })
    try {
      await deleteFile(fileId)
    } catch {
      // ignore delete failure for removed local item
    }
  }, [])

  const handleChatModelChange = useCallback((nextModelId) => {
    setModelId(nextModelId)
    storeChatModel(nextModelId)
    const meta = getChatModelMeta(nextModelId)
    if (!meta.supportsImage) {
      setPendingFiles((prev) => {
        const kept = prev.filter((item) => !isImageAttachment(item.originalName, item.mimeType))
        if (kept.length !== prev.length) {
          message.info('已移除图片附件（当前模型不支持图片识别）')
        }
        return kept
      })
    }
  }, [])

  const handleReplyStyleChange = useCallback((nextStyle) => {
    setReplyStyle(nextStyle)
    storeReplyStyle(nextStyle)
  }, [])

  const submitQuestion = useCallback(
    async (rawPrompt, options = {}) => {
      const { clearInput = false } = options
      const trimmed = String(rawPrompt || '').trim()
      if (!trimmed) return
      if (!getToken()) {
        navigate('/login')
        return
      }
      if (loading) {
        message.warning('请等待当前回答完成')
        return
      }

      const fileIds = pendingFiles.map((item) => item.fileId)
      const attachmentSnapshot = pendingFiles.map((item) => ({
        fileId: item.fileId,
        originalName: item.originalName,
        mimeType: item.mimeType,
      }))

      setPendingFiles([])
      pendingFilesRef.current = []
      if (fileInputRef.current) fileInputRef.current.value = ''

      setLoading(true)
      const localUserMsg = {
        id: `local_u_${Date.now()}`,
        type: 'user',
        message: trimmed,
        attachments: attachmentSnapshot,
      }
      const localAiId = `local_a_${Date.now()}`
      setChatList((prev) => [
        ...prev,
        localUserMsg,
        { id: localAiId, type: 'bot', message: '', reasoning: '', streaming: true, loading: true },
      ])
      if (clearInput) setValue('')
      scrollToBottom()

      streamPendingRef.current = true
      let currentLocalAiId = localAiId

      try {
        const cid = await ensureConversation()
        const abortController = new AbortController()
        streamAbortRef.current = abortController
        streamTextBufferRef.current = ''
        streamReasoningBufferRef.current = ''
        activeStreamMetaRef.current = { conversationId: cid, localAiId, paused: false }
        streamPendingRef.current = false

        await askStream(
          {
            conversationId: cid,
            prompt: trimmed,
            modelId,
            replyStyle,
            deepThinking: modelId === 'deepseek-v4-pro',
            fileIds: fileIds.length ? fileIds : undefined,
          },
          {
            signal: abortController.signal,
            onStart: () => {},
            onDelta: (delta) => {
              streamTextBufferRef.current += delta
              scheduleStreamFlush(localAiId)
            },
            onReasoning: (delta) => {
              streamReasoningBufferRef.current += delta
              scheduleStreamFlush(localAiId)
            },
            onDone: async () => {
              clearStreamFlushTimer()
              applyStreamBuffersToMessage(localAiId, { finish: true })
              await syncMessagesAfterStream(cid)
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
        const errMsg = e?.name === 'AbortError' ? '已取消发送' : getApiErrorMessage(e, '发送失败')
        setChatList((prev) =>
          prev.map((msg) =>
            msg.id === currentLocalAiId ? { ...msg, streaming: false, loading: false } : msg,
          ),
        )
        if (e?.name !== 'AbortError') {
          message.error(errMsg)
        }
      } finally {
        streamPendingRef.current = false
        clearStreamFlushTimer()
        streamAbortRef.current = null
        streamTextBufferRef.current = ''
        streamReasoningBufferRef.current = ''
        activeStreamMetaRef.current = { conversationId: '', localAiId: '', paused: false }
        setLoading(false)
      }
    },
    [
      applyStreamBuffersToMessage,
      clearStreamFlushTimer,
      conversations,
      ensureConversation,
      loading,
      maybeGenerateConversationTitle,
      navigate,
      pendingFiles,
      replyStyle,
      modelId,
      scheduleStreamFlush,
      scrollToBottom,
      syncMessagesAfterStream,
    ],
  )

  const handleRetryQuestion = useCallback(
    async (retryPrompt) => {
      const nextPrompt = String(retryPrompt || '').trim()
      if (!nextPrompt) {
        message.warning('未找到对应问题，无法重新回答')
        return
      }
      setChatList((prev) => {
        const next = [...prev]
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].type === 'bot') {
            next.splice(i, 1)
            break
          }
        }
        return next
      })
      await submitQuestion(nextPrompt)
    },
    [submitQuestion],
  )

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
      message.error(getApiErrorMessage(e, '创建分享链接失败'))
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
        avatar: false,
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
                const aiKey = String(data?.key || '')
                const aiIndex = chatList.findIndex((msg) => msg.id === aiKey)
                let retryPrompt = ''
                for (let i = aiIndex - 1; i >= 0; i -= 1) {
                  if (chatList[i]?.type === 'user') {
                    retryPrompt = chatList[i].message
                    break
                  }
                }
                handleRetryQuestion(retryPrompt)
              }
            }}
          />
        )),
      }),
      user: (data) => ({
        placement: 'end',
        avatar: () => <Avatar className="chat-main-avatar">我</Avatar>,
        typing: false,
        contentRender: (content) => {
          const msgKey = String(data?.key || '')
          const msg = chatList.find((item) => item.id === msgKey)
          const attachments = msg?.attachments || []
          const text = String(content || '').trim()
          return (
            <div className="chat-user-content-wrap">
              <ChatMessageAttachments files={attachments} />
              {text ? <div className="chat-user-text">{text}</div> : null}
            </div>
          )
        },
      }),
    }),
    [actionItems, copyTextSafely, handleRetryQuestion, reasoningExpandedMap, renderMarkdownWithCodeHighlighter, shareMode, toggleReasoningExpanded, chatList],
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
      navigate('/login', { replace: true, state: { fromLogout: true } })
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [navigate])

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }
    refreshMeAndConvs().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    if (!activeConversationId) return
    setShareMode(false)
    setSelectedShareGroupIds([])
    setShareModalOpen(false)
    setReasoningExpandedMap({})
    loadConversationMessages(activeConversationId).catch(() => {})
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

  const showEmptyLayout = !shareMode && chatList.length === 0
  const [composerMorphing, setComposerMorphing] = useState(false)
  const [emptyHeroVisible, setEmptyHeroVisible] = useState(() => !shareMode && chatList.length === 0)
  const [emptyHeroTyped, setEmptyHeroTyped] = useState('')
  const showEmptyLayoutRef = useRef(showEmptyLayout)
  const emptyTypewriterCancelRef = useRef(null)

  const clearEmptyTypewriter = useCallback(() => {
    emptyTypewriterCancelRef.current?.()
    emptyTypewriterCancelRef.current = null
  }, [])

  const startEmptyHeroTypewriter = useCallback(() => {
    clearEmptyTypewriter()
    setEmptyHeroTyped('')
    emptyTypewriterCancelRef.current = runEmptyHeroTypewriter({
      delayMs: COMPOSER_MORPH_MS,
      onUpdate: setEmptyHeroTyped,
    })
  }, [clearEmptyTypewriter])

  useEffect(() => {
    if (showEmptyLayout) {
      setEmptyHeroVisible(true)
    }
  }, [showEmptyLayout])

  useEffect(() => {
    if (showEmptyLayoutRef.current === showEmptyLayout) return
    showEmptyLayoutRef.current = showEmptyLayout
    setComposerMorphing(true)
    const morphTimer = window.setTimeout(() => setComposerMorphing(false), COMPOSER_MORPH_MS)
    let heroTimer
    if (!showEmptyLayout) {
      heroTimer = window.setTimeout(() => setEmptyHeroVisible(false), COMPOSER_MORPH_MS - 80)
    }
    return () => {
      window.clearTimeout(morphTimer)
      if (heroTimer) window.clearTimeout(heroTimer)
    }
  }, [showEmptyLayout])

  useEffect(() => {
    if (!showEmptyLayout || !emptyHeroVisible) {
      clearEmptyTypewriter()
      setEmptyHeroTyped('')
      return undefined
    }
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      clearEmptyTypewriter()
      setEmptyHeroTyped('')
      const revealTimer = window.setTimeout(() => setEmptyHeroTyped(EMPTY_HERO_TEXT), COMPOSER_MORPH_MS)
      return () => window.clearTimeout(revealTimer)
    }
    startEmptyHeroTypewriter()
    return clearEmptyTypewriter
  }, [
    showEmptyLayout,
    emptyHeroVisible,
    activeConversationId,
    startEmptyHeroTypewriter,
    clearEmptyTypewriter,
  ])

  const composerPanelOpen = composerPanel !== null || stylePanelMounted || uploadPanelMounted

  const chatComposer = (
    <div className={`chat-main-composer ${composerPanelOpen ? 'is-panel-open' : ''}`}>
      <div className='chat-main-sender-wrap'>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={getUploadAcceptByModel(modelId)}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <Sender
          loading={loading}
          value={value}
          placeholder="请输入你的问题，按 Enter 发送"
          onChange={(v) => {
            setValue(v)
          }}
          onSubmit={async (message) => {
            await submitQuestion(message, { clearInput: true })
          }}
          onCancel={handleStopSending}
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
        <div className='chat-main-tools-inside'>
          <div className='chat-main-tools-left'>
            <button
              type="button"
              className={`chat-main-attach-btn ${composerPanel === 'upload' ? 'is-open' : ''} ${pendingFiles.length ? 'has-files' : ''}`}
              disabled={loading}
              aria-label={getUploadHintByModel(modelId)}
              title={getUploadHintByModel(modelId)}
              onClick={handleOpenUploadPanel}
            >
              <PaperClipOutlined />
            </button>
          </div>
          <div className='chat-main-tools-right'>
            <ReplyStyleNeonTrigger
              value={replyStyle}
              open={composerPanel === 'style'}
              disabled={loading}
              onOpenChange={() => toggleComposerPanel('style')}
            />
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
        </div>
      </div>
      <ReplyStylePanel
        value={replyStyle}
        open={composerPanel === 'style'}
        disabled={loading}
        onOpenChange={(open) => setComposerPanel(open ? 'style' : null)}
        onMountChange={setStylePanelMounted}
        onChange={handleReplyStyleChange}
      />
      <ComposerUploadPanel
        open={composerPanel === 'upload'}
        onClose={() => setComposerPanel(null)}
        onMountChange={setUploadPanelMounted}
        modelId={modelId}
        disabled={loading}
        pendingFiles={pendingFiles}
        uploading={uploadingFile}
        uploadProgress={uploadProgress}
        uploadingFileName={uploadingFileName}
        onPickFiles={handlePickFiles}
        onUploadFiles={handleUploadFiles}
        onRemoveFile={handleRemovePendingFile}
      />
    </div>
  )

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
          size="82vw"
          styles={{
            header: {
              display: 'none',
            },
            body: {
              padding: 0,
              backgroundColor: 'var(--app-sider-bg)',
            },
            section: {
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
            onCreateNew={() => handleCreateNew({ closeMobileDrawer: true })}
            onRename={async (id, title) => {
              try {
                const updated = await updateConversation(id, { title })
                setConversations((prev) =>
                  sortConversations(prev.map((c) => (c.id === id ? { ...c, ...updated } : c))),
                )
                message.success('重命名成功')
              } catch (e) {
                message.error(getApiErrorMessage(e, '重命名失败'))
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
                message.error(getApiErrorMessage(e, '置顶操作失败'))
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
                message.error(getApiErrorMessage(e, '删除失败'))
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
          trigger={null}
          collapsed={collapsed}
          collapsedWidth={0}
          onCollapse={setCollapsed}
        >
          <ChatSide
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(true)}
            items={sideItems}
            hasMore={conversationHasMore}
            loadingMore={conversationLoadingMore}
            onListScroll={handleSideListScroll}
            selectedKey={activeConversationId}
            onSelect={async (id) => {
              setActiveConversationId(id)
            }}
            onCreateNew={handleCreateNew}
            onRename={async (id, title) => {
              try {
                const updated = await updateConversation(id, { title })
                setConversations((prev) =>
                  sortConversations(prev.map((c) => (c.id === id ? { ...c, ...updated } : c))),
                )
                message.success('重命名成功')
              } catch (e) {
                message.error(getApiErrorMessage(e, '重命名失败'))
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
                message.error(getApiErrorMessage(e, '置顶操作失败'))
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
                message.error(getApiErrorMessage(e, '删除失败'))
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
      <Content
        style={{
          backgroundColor: 'var(--app-content-bg)',
          minWidth: 0,
          minHeight: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className={`chat-main ${showEmptyLayout ? 'is-empty' : ''} ${composerMorphing ? 'is-composer-morphing' : ''}`}>
          <div className={`chat-main-header ${isMobile ? 'is-mobile' : ''} ${!isMobile && collapsed ? 'is-sider-collapsed' : ''}`}>
            <div className='chat-main-header-left'>
              {isMobile ? (
                <Button
                  className='chat-main-menu-btn'
                  type="text"
                  icon={<SvgIcon name={'collapse'} size={18} />}
                  onClick={() => setMobileSideOpen(true)}
                />
              ) : null}
              {!isMobile && collapsed ? (
                <div className='chat-main-header-toolbar'>
                  <Button
                    type="text"
                    className='chat-header-control chat-header-control--icon'
                    icon={<SvgIcon name={'collapse'} size={18} />}
                    aria-label="展开侧边栏"
                    title="展开侧边栏"
                    onClick={() => setCollapsed(false)}
                  />
                  <Button
                    type="text"
                    className='chat-header-control chat-header-control--icon'
                    icon={<SvgIcon name="plus" size={18} />}
                    aria-label="新建对话"
                    title="新建对话"
                    onClick={() => handleCreateNew()}
                  />
                </div>
              ) : null}
              <div className='chat-main-model-select-wrap'>
                <ChatModelSelect value={modelId} disabled={loading} onChange={handleChatModelChange} />
              </div>
            </div>
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
          <div className='chat-main-body'>
            {showEmptyLayout ? <div className='chat-main-empty-spacer' aria-hidden='true' /> : null}
            {!showEmptyLayout ? (
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
            ) : null}
            <div className={`chat-main-footer-shell ${showEmptyLayout ? 'is-elevated' : ''}`}>
              {emptyHeroVisible ? (
                <div className={`chat-main-empty-hero ${!showEmptyLayout ? 'is-leaving' : ''}`}>
                  <h2 className='chat-main-empty-title' aria-label={EMPTY_HERO_TEXT}>
                    {emptyHeroTyped}
                    {emptyHeroTyped.length > 0 && emptyHeroTyped.length < EMPTY_HERO_TEXT.length ? (
                      <span className='chat-main-empty-title-caret' aria-hidden='true' />
                    ) : null}
                  </h2>
                </div>
              ) : null}
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
                  chatComposer
                )}
              </div>
            </div>
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
