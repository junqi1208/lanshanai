import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin, Empty, Typography, message, Button, Tag } from 'antd'
import XMarkdown from '@ant-design/x-markdown'
import { getShareDetail } from '@/api/share'
import { getApiErrorMessage } from '@/utils/getApiErrorMessage'
import logo from '@/assets/images/logo-256.png'
import '@/style/share.scss'

export default function SharePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getShareDetail(token)
      .then((res) => {
        setDetail(res || null)
      })
      .catch((e) => {
        message.error(getApiErrorMessage(e, '分享内容加载失败'))
        setDetail(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  const groupCount = detail?.groups?.length || 0
  const messageCount = detail?.groups?.reduce((acc, group) => acc + (group?.messages?.length || 0), 0) || 0
  const createdAtText = detail?.createdAt
    ? new Date(detail.createdAt).toLocaleString('zh-CN', { hour12: false })
    : '--'

  return (
    <div className='share-page'>
      <div className='share-page-inner'>
        <div className='share-page-header'>
          <div className='share-page-header-top'>
            <div className='share-page-brand'>
              <img src={logo} alt="览山AI" loading="lazy" decoding="async" />
              <div className='share-page-brand-text'>
                <div className='share-page-brand-name'>览山AI</div>
                <div className='share-page-brand-desc'>智能问答 · 知识协作</div>
              </div>
            </div>
            <div className='share-page-cover-tags'>
              <Tag color="blue">公开分享</Tag>
              <Tag>分享来源：览山AI 对话</Tag>
            </div>
          </div>
          <div className='share-page-header-bottom'>
            <div>
              <Typography.Title level={3}>{detail?.title || '分享会话'}</Typography.Title>
              <Typography.Paragraph className='share-page-subtitle'>
                共 {groupCount} 组对话，{messageCount} 条消息 · 创建于 {createdAtText}
              </Typography.Paragraph>
            </div>
            <Button onClick={() => navigate('/chat')}>返回聊天</Button>
          </div>
        </div>
      </div>
      <div className='share-page-inner'>
        <div className='share-page-content'>
          {loading ? (
            <div className='share-page-loading'>
              <Spin />
            </div>
          ) : null}
          {!loading && (!detail?.groups || detail.groups.length === 0) ? <Empty description="暂无分享内容" /> : null}
          {!loading && detail?.groups?.length ? (
            <div className='share-page-groups'>
              {detail.groups.map((group, index) => (
                <div className='share-page-group' key={group.groupId}>
                  <div className='share-page-group-title'>第 {index + 1} 组对话</div>
                  {group.messages.map((msg) => (
                    <div
                      className={`share-page-message ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}
                      key={msg.id}
                    >
                      <div className='share-page-message-content'>
                        <XMarkdown content={String(msg.content || '')} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

