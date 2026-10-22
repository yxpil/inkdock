# 墨坞 Inkdock · 架构规范

版本：0.2  
更新：2026-10-23  
状态：M1 实现基线；书封与故事设定增量已交付  
关联：[需求分析](./00-requirements.md) · [数据模型](./03-data-model.md) · [路线图](./04-roadmap.md)

---

## 1. 技术选型

| 层 | 选型 | 理由 | 代价 / 边界 |
| --- | --- | --- | --- |
| 全栈框架 | Next.js 16 App Router + React 19 | 服务端读库、路由处理器、流式渲染一体；页面与 API 同仓 | 服务端与客户端边界需要严格区分 |
| 语言 | TypeScript strict | 数据结构是产品核心，需要编译期约束 | 初期类型样板略多 |
| 样式 | Tailwind CSS 4 + CSS 令牌 | 令牌集中、无运行时 CSS-in-JS、体积小 | 复杂排版仍需少量原生 CSS |
| 数据库 | SQLite（`node:sqlite`，WAL） | 零外部服务、单文件备份、Node 24 内置无原生编译 | 单写者；协作期需迁移服务端数据库 |
| 数据访问 | 原生 SQL + repository | 查询可控、无 ORM 学习成本 | 需要手写映射与迁移 |
| 图标 | lucide-react（线性） | 统一线宽、无 emoji | 需筛选与设计一致的图标 |
| AI | OpenAI 兼容 HTTP 接口 | 可接 DeepSeek、OpenAI、本地模型 | M1 非流式；无内置模型 |
| 部署 | 单机 Node（M1） | 本地优先；数据不出机 | 公网部署前必须补鉴权 |

### 1.1 已否决方案

- **纯前端 + IndexedDB**：跨设备与协作路径难，服务端渲染预览麻烦。
- **Prisma + better-sqlite3**：M1 无必要引入原生编译与生成步骤；`node:sqlite` 足够。
- **富文本编辑器（ProseMirror/TipTap）**：正文事实源保持纯文本，富文本会引入格式与协作复杂度。
- **按字数估算分页**：与真实排版差异大，违背「预览即真相」。

---

## 2. 运行拓扑

```
Browser
  ├── React Server Components  ── 读 ──┐
  ├── Route Handlers (/api/*) ── 写 ──┤──> repository ──> node:sqlite (data/inkdock.db, WAL)
  ├── Client Components (editor, reader) │
  └── localStorage (draft / prefs)       │
                                          └──> AI provider (optional, server only)
```

单进程、单数据库。M1 无后台任务、无队列。

---

## 3. 目录规范

```
src/
  app/
    layout.tsx                 根布局、主题引导脚本
    globals.css                设计令牌 + 基础样式 + 组件类
    page.tsx                   重定向至 /library
    library/page.tsx           书架（服务端取数）
    works/[workId]/page.tsx    作品详情
    write/[chapterId]/page.tsx 编辑器
    preview/[workId]/page.tsx  手机预览
    settings/page.tsx          设置
    api/
      works/…                  作品、书封、卷、章节、设定、导出
      chapters/[id]/…          保存、版本
      story-entities/[id]/     设定更新与删除
      ai/assist/                AI 代理
      me/                      本机作者资料
  components/
    studio-shell.tsx           工作台外壳（顶栏 + 侧栏 + 移动导航）
    ui/                        Button、Modal、Field、Toast、Menu 等原语
    library/                   书架视图与新建作品
    work/                      作品详情、卷章管理与书封选择
    editor/                    编辑器工作区、大纲、AI 面板、故事设定
    reader/                    设备、平台皮肤、分页器、设置
    book-cover.tsx             图片书封与平涂书封的统一渲染
  lib/
    db.ts                      连接、schema、种子数据
    queries.ts                 全部 SQL 读操作
    mutations.ts               全部 SQL 写操作
    types.ts                   领域类型
    constants.ts               状态、导航、书封与设定识别色
    words.ts                   字数口径
    platforms.ts               五个平台的设计参数
    utils.ts                   日期、类名、文件名
    ai.ts                      AI 服务商适配
  hooks/
    use-autosave.ts            自动保存状态机
```

规则：

- 组件不直接访问数据库；server page 调用 `queries`，route handler 调用 `mutations`。
- 共享的纯函数不得导入服务端模块（`node:sqlite`、`fs`）。
- 平台皮肤只允许出现在 `lib/platforms.ts` 与 `components/reader/*`。
- 书封与设定识别色是用户数据，只能来自 `lib/constants.ts` 的调色板；界面样式仍使用语义令牌。
- 页面级色彩必须使用语义令牌。

---

## 4. 数据流

### 4.1 读取

```
Server Page (force-dynamic)
  -> queries.getWork / getChapterBundle / listWorks
  -> 序列化 props
  -> Client Component 渲染
```

M1 所有读库页面设置 `dynamic = "force-dynamic"`，避免构建期快照过期。

### 4.2 写入

```
Client 事件
  -> fetch POST/PATCH
  -> route handler 校验输入与归属
  -> mutations（事务）
  -> JSON { ... }
  -> router.refresh() 或本地乐观更新
```

服务端为唯一事实源；客户端状态只保存「正在编辑的内容」。

### 4.3 书封

```
选择文件（JPEG/PNG/WebP，原始 ≤12 MB）
  -> Canvas 居中裁剪为 4:5，输出 800x1000
  -> toDataURL("image/jpeg", 0.84 / 0.72 / 0.6) 直到 ≤1,000,000 字符
  -> POST/PATCH /api/works（coverImage data URL）
  -> 服务端校验 data URL 前缀、总长 ≤1,100,000、解码 ≤700,000 字节、文件头
  -> works.cover_image -> 书架、作品页、预览入口共用 BookCover
```

- 无图时 `BookCover` 使用 `cover_color`、书名、作者与几何线条排版；有图时图片铺满 4:5，底部只叠一条平涂信息带。
- 清空封面写 `null`。更新作品时若省略 `coverImage`，服务端保留原值，避免资料编辑误删封面。
- M1 不引入对象存储与图片处理服务：数据库单文件便于备份，封面已在客户端压缩到可控大小。

### 4.4 故事设定

```
EditorWorkspace 加载 EditorBundle.storyEntities
  -> 宽屏：右侧标签页「故事设定」；窄屏：右侧抽屉（同一面板组件）
  -> StoryBiblePanel 本地 state 保存列表与详情选择
  -> 新建/编辑弹窗 POST/PATCH /api/.../story-entities
  -> 成功后原地合并列表并进入详情，不刷新页面、不打断草稿
```

- 面板与弹窗都渲染在编辑器组件内，但弹窗通过 portal 挂到 `document.body`；否则抽屉的 `transform` 会成为 fixed 定位上下文，导致弹窗被裁切。
- 桌面与移动端共享同一份 `storyEntities` 提升状态；关闭抽屉不会丢失未提交的列表更新。
- 设定不参与自动保存协议；它有自己的 CRUD 接口，失败时在弹窗内显示可行动错误。
- 设定不会注入正文、预览或导出；AI 上下文接入是后续能力。

---

## 5. 自动保存协议

### 5.1 客户端状态机

```
idle/saved ──输入──> dirty
dirty ──900ms 防抖/20s 兜底/失焦/隐藏──> saving
saving ──200──> saved
saving ──网络错误──> retrying (6s/12s/24s，封顶 30s)
saving ──409──> conflict
retrying ──恢复在线/重试──> saving
conflict ──载入远端──> saved（重新加载）
conflict ──覆盖──> saving（以服务端最新时间戳为 base）
```

### 5.2 请求

`PATCH /api/chapters/:id`

```json
{
  "baseUpdatedAt": "2026-10-22T13:12:00.000Z",
  "title": "第二章 雾中的灯",
  "content": "正文……",
  "status": "draft"
}
```

响应：

```json
{
  "ok": true,
  "chapter": {
    "id": "...",
    "updatedAt": "2026-10-22T13:12:01.200Z",
    "wordCount": 1820
  },
  "revisionCreated": false
}
```

冲突 409：

```json
{
  "ok": false,
  "code": "conflict",
  "error": "章节已在别处更新",
  "current": { "updatedAt": "...", "wordCount": 1902 }
}
```

规则：

1. 仅当 `baseUpdatedAt` 存在且与数据库不一致时返回 409。
2. `sendBeacon` 的应急保存不带 `baseUpdatedAt`，最后写入优先；并在客户端明确记录。
3. 保存成功后更新客户端 base 时间戳。
4. 服务端在事务内更新章节、统计当日新增字数、按需插入版本快照。

### 5.3 本地草稿

- key：`ink:draft:<chapterId>`
- 内容：`{ title, content, status, baseUpdatedAt, savedLocallyAt }`
- 输入即覆盖写；服务端确认后删除。
- 打开编辑器时，若本地 `baseUpdatedAt` 晚于服务端 `updatedAt` 且正文不同，展示恢复条，不自动覆盖。
- 额度上限约 5 MB；异常时静默降级（服务端保存仍有效）。

### 5.4 版本快照

- 手动快照：`POST /api/chapters/:id/revisions` 立即插入；M1 只有接口，版本历史界面在 M1.5。
- 自动：正文变化，且距该章最新版本 > 15 分钟。
- 恢复版本：先把当前正文快照一次，再写入目标内容。
- 快照上限策略：M2 增加按章节保留最近 50 个 + 手动标记永久保留。

---

## 6. 冲突与协作演进

| 阶段 | 机制 | 说明 |
| --- | --- | --- |
| M1 | 章节级乐观锁（`updated_at`） | 单人多标签页已足够 |
| M2 | 成员表、角色、邀请码 | 权限前置 |
| M3 | 章节操作日志 + 在线状态 | 可审计；非实时 |
| M3+ | Yjs CRDT + WebSocket | 正文实时协同；SQLite 存快照 |
| 长期 | Postgres + 对象存储 + 队列 | 多实例部署、审计、备份 |

升级原则：正文的权威历史始终是版本快照；CRDT 增量只是运行态，定期物化为纯文本快照，避免锁定单一协同引擎。

---

## 7. API 契约

所有写接口要求 `Content-Type: application/json`，返回 JSON。错误格式统一：

```json
{ "ok": false, "code": "invalid", "error": "书名不能为空" }
```

| 方法 | 路径 | 用途 | 关键校验 |
| --- | --- | --- | --- |
| GET | `/api/works` | 作品列表 | 只返回未归档 |
| POST | `/api/works` | 新建作品 + 第一卷 + 第一章 | 书名 1–60；目标字数 0–10,000,000；书封格式与大小 |
| PATCH | `/api/works/:id` | 更新资料/状态/书封 | 归属；字段白名单；封面可置空 |
| DELETE | `/api/works/:id` | 归档 | 软删除 |
| POST | `/api/works/:id/volumes` | 新建卷 | 标题 1–60 |
| PATCH | `/api/volumes/:id` | 更新卷 | 归属 |
| DELETE | `/api/volumes/:id` | 删除卷 | 必须为空卷 |
| POST | `/api/works/:id/chapters` | 新建章节 | 卷属于该作品 |
| PATCH | `/api/chapters/:id` | 自动保存 / 状态 / 移动 | 乐观锁；标题 ≤ 120；正文 ≤ 2 MB |
| DELETE | `/api/chapters/:id` | 软删除章节 | 至少保留一章？否，可为空卷 |
| GET | `/api/chapters/:id/revisions` | 版本列表 | 不含正文，避免大响应 |
| POST | `/api/chapters/:id/revisions` | 手动快照 / 恢复 | `{ action: "snapshot" }` 或 `{ action: "restore", revisionId }` |
| GET | `/api/works/:id/story-entities` | 设定列表 | 只返回未归档作品 |
| POST | `/api/works/:id/story-entities` | 新建设定 | 类型枚举；名称 1–60；摘要 ≤300；详细 ≤6000 |
| PATCH | `/api/story-entities/:id` | 更新设定 | 归属未归档作品；字段白名单 |
| DELETE | `/api/story-entities/:id` | 删除设定 | 硬删除；不影响作品时间与正文 |
| GET | `/api/works/:id/export?format=txt` | 导出 | 格式枚举；文件名安全化 |
| GET | `/api/ai/assist` | 配置状态 | 不返回密钥 |
| POST | `/api/ai/assist` | 生成建议 | 动作枚举；正文截断；超时 |
| PATCH | `/api/me` | 修改笔名 | 1–24 字 |

M1 无鉴权，所有写操作绑定本机作者 `local-user`。M2 引入会话后，在 `requireMember(workId, userId, role)` 中统一鉴权。

### 7.1 书封与设定接口细节

书封请求体：

```json
{
  "coverImage": "data:image/jpeg;base64,...",
  "coverColor": "#2F4B46"
}
```

- `coverImage` 省略：保留当前封面；`null` 或空串：清空；字符串：完整校验后替换。
- 错误码：`invalid_cover`（格式或文件头不符）、`cover_too_large`（字符或解码字节超限）。
- 客户端最多读取 12 MB 源文件；最终 data URL 目标 ≤1,000,000 字符，服务端上限 1,100,000 字符 / 700,000 解码字节。

设定请求体：

```json
{
  "type": "character",
  "name": "许砚",
  "subtitle": "回到雾港的长子",
  "summary": "他记得所有失踪者的名字。",
  "description": "背景、动机、关系与伏笔……",
  "color": "#3D6B5A"
}
```

- `type`：`character` / `organization` / `location` / `item` / `concept`。
- `name` 必填且 ≤60；`subtitle` ≤80；`summary` ≤300；`description` ≤6000；`color` 必须是 `#RRGGBB`。
- 新建自动分配 `sort = max + 1000`，列表按类型与 sort 渲染；M1 不提供拖拽排序。
- 产品文案明确说明「设定不会进入正文、手机预览或导出」。后续 M2 深化双向链接与时间线，M3 才接入 AI 上下文。

---

## 8. 排版与分页

### 8.1 设备

- 逻辑尺寸 393 × 852，通过 CSS `transform: scale()` 适配容器，不改变内部布局测量。
- 阅读区域测量使用未缩放的 `clientWidth/clientHeight`。

### 8.2 CSS 多栏分页

```
viewport (宽 W，高 H，overflow hidden)
└── pages (width = W - 2P)
      column-width = W - 2P
      column-gap = 2P
      height = H - 上下留白
      translateX(-page * W)
```

- 第 i 页左边界位于 `P + i * W`，平移整页宽后正好裁切出单页。
- 页数：`round((scrollWidth + gap) / (columnWidth + gap))`，至少 1。
- 重算时机：章节切换、字号/行高/边距/字体/平台变化、容器尺寸变化、字体加载完成。
- 重算后页码收敛：若旧页码超出新页数，钳制到最后一页。
- 测量必须在 `requestAnimationFrame` 后执行，避免拿到旧布局。

### 8.3 翻页

- 状态：`page`、`pendingPrevChapterLast`、`dragStart`。
- 下一页：页内 +1；末页且有下一章 → 切章并归零。
- 上一页：页内 -1；首页且有上一章 → 切章并等待测量后落到末页。
- 点击区域：左 35% 上一页，右 65% 下一页；选中文本时不翻页。
- 手势：pointerdown/up，横向位移 > 40 px 且横向大于纵向时翻页；使用 `touch-action: pan-y` 保留纵向滚动。
- 键盘：←、→、空格、PageUp/PageDown；输入控件聚焦时忽略。

---

## 9. AI 代理

```
POST /api/ai/assist
  { action: "continue" | "polish" | "title" | "outline",
    instruction?, context: { workTitle, genre, chapterTitle, content } }
```

- 环境变量：`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`。
- 服务端拼装 system prompt，截取正文尾部最多 6000 字，限制输出 1200 tokens。
- 超时 60 秒；不重试，避免重复计费。
- 错误映射：未配置 501、超时 504、上游失败 502、输入非法 400。
- Prompt 明确：仅提供建议，不自动写入；中文；不使用 emoji；续写保持视角与时态。
- 密钥不进入客户端、数据库、日志；错误日志只记录状态码与耗时。

---

## 10. 安全与数据

- M1 是本机单用户工具。`data/*.db` 已加入 `.gitignore`。
- 所有 SQL 使用参数绑定。
- 写接口做字段白名单与长度限制，防止超大正文拖垮进程。
- React 默认转义；不渲染 Markdown/HTML。
- 导出文件名去除控制字符与路径分隔符。
- 公网部署前置条件（M2）：账号认证、作品成员校验、CSRF/Origin 校验、速率限制、备份策略。

---

## 11. 性能与容量

| 场景 | 目标 | 手段 |
| --- | --- | --- |
| 书架查询 | < 50 ms / 100 本书 | 聚合子查询 + 索引 `works(updated_at)`、`chapters(work_id)` |
| 章节打开 | < 100 ms | 单次 bundle 查询，按 work_id 取卷章 |
| 自动保存 | < 30 ms | 单事务 + WAL；正文大小上限 2 MB |
| 分页 | < 50 ms | 一次布局测量；不在滚动中计算 |
| 编辑器输入 | 无可感知延迟 | 本地 state；防抖写库；不依赖服务端往返 |

容量目标（M1）：500 本书、50,000 章、2 GB 正文。超出后迁移服务端数据库。

---

## 12. 可观测性

- M1：服务端 `console.error` 记录保存失败、AI 上游失败、数据库错误；不含正文与密钥。
- 客户端保存状态在界面可见，不需要打开控制台。
- M2：结构化事件（save_ok、save_conflict、ai_request）落本地表，提供设置页诊断导出。

---

## 13. 测试策略

| 层 | M1 | 后续 |
| --- | --- | --- |
| 类型 | `tsc --noEmit` | 保持 |
| 构建 | `next build` | CI |
| 手工浏览器 | 桌面 + 390 宽手机，逐页验收 | 每里程碑 |
| 单元 | 字数统计、文件名、分页页数换算 | Vitest |
| 接口 | 自动保存、冲突、卷删除约束、书封校验、设定 CRUD | 集成测试 |
| E2E | 后续 Playwright：新建→写→刷新→预览翻页 | M2 |

当前书封与设定的端到端证据来自 `.shots/verify-options.mjs`：真实上传、刷新持久化、书架渲染、设定新建/编辑/筛选/详情/删除、390 宽抽屉无溢出。该脚本与截图属于本地验收工具，不随仓库分发。

M1 的验收以真实浏览器为准，不以「代码看起来正确」为准。

---

## 14. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| `node:sqlite` API 演进 | 升级 Node 后不兼容 | 数据层隔离在 `lib/db.ts`，必要时替换 better-sqlite3 |
| CSS 多栏跨浏览器差异 | 页数偏差 | 以 Chromium 为准；Safari 后续专项校准 |
| 自动保存与导航竞争 | 丢失最后一段 | flush + 本地副本 + sendBeacon 三层 |
| 平台 UI 变更 | 模拟失真 | 标注模拟；参数集中；M2 可配置 |
| AI 成本 | 意外计费 | 手动触发、正文截断、输出上限、超时 |
| 单机数据库损坏 | 全书丢失 | WAL + 备份导出（M2）；文档提示定期备份 |

---

## 15. 关键设计决策（ADR 摘要）

- **ADR-001**：正文纯文本。发布格式在预览层解决，避免创作数据耦合。
- **ADR-002**：SQLite 本地优先。M1 以可靠、可备份、零运维优先，协作时迁移。
- **ADR-003**：自动保存以服务端为权威，客户端只保留短期草稿。
- **ADR-004**：分页必须真实测量。预览功能的价值取决于排版可信度。
- **ADR-005**：设计系统禁止渐变与 emoji，以令牌约束实现。
- **ADR-006**：AI 未配置时诚实降级，不生成伪结果。
- **ADR-007**：书封在客户端裁剪压缩后以 data URL 存 SQLite。M1 优先单文件备份与零外部依赖；代价是库体积增大，M5 上对象存储时再迁移。
- **ADR-008**：故事设定独立建表，不与章节正文耦合。设定是写作参考，不是发布内容；未来做双向链接时只增加关联表，不改正文格式。
