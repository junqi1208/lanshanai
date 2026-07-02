import { Link } from 'react-router-dom'
import { Button, Tag, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import useThemeMode from '@/hooks/useThemeMode'
import MermaidDiagram from '@/components/MermaidDiagram'
import logo from '@/assets/images/logo-256.png'
import '@/style/about.scss'

const ARCHITECTURE_CHART = `
flowchart TB
  User(["用户浏览器"])

  subgraph FW["front-web · React + Vite"]
    direction TB
    ChatUI["对话页 / 会话列表"]
    UploadUI["附件上传"]
    StreamUI["流式输出"]
    ShareUI["分享页"]
  end

  subgraph SV["server · NestJS"]
    direction TB
    Auth["JWT 鉴权"]
    ConvAPI["会话 / 消息"]
    FileAPI["文件上传与解析"]
    AiGW["AiService<br/>转发 · 存库 · 出错回滚"]
  end

  DB[("MySQL")]
  Disk[("本地文件")]

  subgraph LC["langchain-server · FastAPI"]
    direction TB
    Prompt["拼 prompt + 历史"]
    Route["选模型 DeepSeek / Qwen"]
    Tools["工具调用 天气等"]
    Stream["/chat/stream"]
  end

  subgraph LLM["模型 API"]
    DS["DeepSeek"]
    QW["通义千问"]
  end

  User --> ChatUI
  User --> ShareUI

  ChatUI -->|"① 上传文件"| FileAPI
  FileAPI --> Disk
  FileAPI --> DB

  ChatUI -->|"② 提问 stream"| AiGW
  UploadUI -.->|"fileIds"| ChatUI
  AiGW --> Auth
  Auth --> ConvAPI
  ConvAPI --> DB
  AiGW -->|"读附件"| FileAPI
  FileAPI --> Disk
  AiGW -->|"③ 转发"| Prompt
  Prompt --> Route
  Route --> Tools
  Route --> Stream
  Stream --> DS
  Stream --> QW

  DS -.->|"token"| Stream
  QW -.->|"token"| Stream
  Stream -.->|"SSE"| AiGW
  AiGW -->|"存回答"| ConvAPI
  AiGW -.->|"④ 推给前端"| StreamUI
  StreamUI --> User

  classDef client fill:#dbeafe,stroke:#3b82f6,color:#1e3a8a
  classDef bff fill:#dcfce7,stroke:#22c55e,color:#14532d
  classDef ai fill:#fef3c7,stroke:#f59e0b,color:#78350f
  classDef store fill:#f3e8ff,stroke:#a855f7,color:#581c87
  classDef llm fill:#ffe4e6,stroke:#f43f5e,color:#881337

  class ChatUI,UploadUI,StreamUI,ShareUI client
  class Auth,ConvAPI,FileAPI,AiGW bff
  class Prompt,Route,Tools,Stream ai
  class DB,Disk store
  class DS,QW llm
`

const TECH_STACKS = [
  {
    name: 'front-web',
    role: '客户端',
    items: [
      'React 19',
      'Vite',
      'React Router',
      'Ant Design / Ant Design X',
      'Sass',
      'Axios + Fetch SSE',
    ],
  },
  {
    name: 'server',
    role: '中间服务',
    items: [
      'NestJS 10',
      'TypeScript',
      'Express',
      'TypeORM',
      'MySQL（mysql2）',
      'SQLite（本地开发）',
      'Passport',
      'passport-jwt / passport-local',
      'bcrypt',
      '@nestjs/jwt',
      '@nestjs/config',
      'class-validator / class-transformer',
      'Multer',
      'pdf-parse',
      'mammoth',
      'axios',
      'rxjs',
      'Jest',
    ],
  },
  {
    name: 'langchain-server',
    role: '推理服务',
    items: [
      'Python',
      'FastAPI',
      'uvicorn',
      'LangChain',
      'langchain-openai',
      'pydantic-settings',
      'httpx',
    ],
  },
  {
    name: '存储与外部依赖',
    role: '基础设施',
    items: [
      'MySQL',
      '本地文件系统',
      'DeepSeek API',
      '阿里云百炼 · 通义千问',
    ],
  },
]

const LAYERS = [
  {
    name: 'front-web',
    role: '前端',
    duty: '聊天界面、上传附件、流式显示回复、会话列表和分享页。',
  },
  {
    name: 'server',
    role: '接口层',
    duty: '登录注册、会话和消息的增删改查、文件上传解析、调 langchain-server 并把 SSE 流转发给前端。业务数据都在这层落库。',
  },
  {
    name: 'langchain-server',
    role: '推理服务',
    duty: '单独进程跑，不连业务库。负责拼 prompt、选模型、调工具、流式请求 DeepSeek / Qwen。只接受 server 过来的内网请求，带 X-Internal-Api-Key。',
  },
]

export default function AboutPage() {
  const { resolvedTheme } = useThemeMode()

  return (
    <div className={`about-page${resolvedTheme === 'dark' ? ' is-dark' : ''}`}>
      <div className="about-page-inner">
        <header className="about-page-header">
          <div className="about-page-header-top">
            <div className="about-page-brand">
              <img src={logo} alt="览山AI" loading="lazy" decoding="async" />
              <div className="about-page-brand-text">
                <div className="about-page-brand-name">览山 AI</div>
                <div className="about-page-brand-desc">作者：孙俊淇</div>
              </div>
            </div>
            <Link to="/login">
              <Button icon={<ArrowLeftOutlined />}>返回登录</Button>
            </Link>
          </div>
          <div className="about-page-header-bottom">
            <Typography.Title level={3}>架构说明</Typography.Title>
            <Typography.Paragraph className="about-page-lead">
              这是一个个人开发的 AI 对话项目，拆成三个部分：React 前端、NestJS 接口、Python 推理服务。
              下面列各层技术栈和整体架构图。
            </Typography.Paragraph>
          </div>
        </header>

        <section className="about-page-section">
          <h2 className="about-page-section-title">技术栈</h2>
          <div className="about-page-stacks">
            {TECH_STACKS.map((layer) => (
              <div className="about-page-stack-card" key={layer.name}>
                <div className="about-page-stack-head">
                  <span className="about-page-stack-name">{layer.name}</span>
                  <Tag>{layer.role}</Tag>
                </div>
                <ul className="about-page-stack-list">
                  {layer.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="about-page-section">
          <h2 className="about-page-section-title">架构</h2>
          <MermaidDiagram
            chart={ARCHITECTURE_CHART}
            theme={resolvedTheme}
            className="about-page-mermaid about-page-mermaid--arch"
          />
        </section>

        <section className="about-page-section">
          <h2 className="about-page-section-title">三个部分各干什么</h2>
          <div className="about-page-layers">
            {LAYERS.map((layer) => (
              <div className="about-page-layer-card" key={layer.name}>
                <div className="about-page-layer-head">
                  <span className="about-page-layer-name">{layer.name}</span>
                  <Tag>{layer.role}</Tag>
                </div>
                <p className="about-page-layer-duty">{layer.duty}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="about-page-footer">
          <Link to="/login">
            <Button type="primary" size="large">去登录</Button>
          </Link>
        </footer>
      </div>
    </div>
  )
}
