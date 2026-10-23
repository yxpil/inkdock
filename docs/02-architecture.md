# 墨坞 Inkdock · 架构规范

版本：0.4  
更新：2026-10-23  
状态：M1 实现基线；书封、故事设定、章节插画、本机多账号、整书迁移、单文件网页导出与改密已交付（schema v4）  
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
| 鉴权 | 本机会话 cookie + 作品成员角色 | 无外部身份服务；密码与数据都不出机 | 单机有效；公网需补 CSRF、限流、HTTPS 与密码恢复 |
| 部署 | 单机 Node（M1） | 本地优先；数据不出机 | 公网部署前必须补鉴权加固 |

### 1.1 已否决方案

- **纯前端 + IndexedDB**：跨设备与协作路径难，服务端渲染预览麻烦。
- **Prisma + better-sqlite3**：M1 无必要引入原生编译与生成步骤；`node:sqlite` 足够。
- **富文本编辑器（ProseMirror/TipTap）**：正文事实源保持纯文本，富文本会引入格式与协作复杂度。
- **Markdown/HTML 内嵌图片**：图片标记会污染正文与字数口径；插画改用独立表 + 段落锚点。
- **按字数估算分页**：与真实排版差异大，违背「预览即真相」。
- **邮箱/第三方登录**：本机工具没有邮件投递与身份提供方；先做自包含账号，云端阶段再接 OAuth。

---

## 2. 运行拓扑

```
Browser
  ├── /login（公开）──> 注册 / 登录 ──> sessions + httpOnly cookie
  ├── React Server Components  ── 读（requireUser + 成员校验）──┐
  ├── Route Handlers (/api/*) ── 写（requireApiUser + 角色校验）┤──> repository ──> node:sqlite (data/inkdock.db, WAL)
  ├── Client Components (editor, reader) │
  └── localStorage (draft / prefs)       │
                                          └──> AI provider (optional, server only)
```

单进程、单数据库。除注册、登录页与对应 API 外，页面与接口都要求有效会话。M1 无后台任务、无队列。

---

## 3. 目录规范

```
src/
  app/
    layout.tsx                 根布局、主题引导脚本
    globals.css                设计令牌 + 基础样式 + 组件类
    page.tsx                   重定向至 /library（未登录则 /login）
    login/page.tsx             登录与注册
    not-found.tsx              中文品牌 404
    library/page.tsx           书架（服务端取数）
    works/[workId]/page.tsx    作品详情
    write/[chapterId]/page.tsx 编辑器
    preview/[workId]/page.tsx  手机预览
    settings/page.tsx          设置
    api/
      auth/…                   注册、登录、登出、改密
      works/…                  作品、书封、卷、章节、设定、成员、整书导入、导出（TXT / Markdown / HTML / JSON）
      chapters/[id]/…          保存、版本、插画新建
      illustrations/[id]/…     插画更新、删除、二进制图片
      story-entities/[id]/     设定更新与删除
      ai/assist/                AI 代理
      me/                      当前账号资料
  components/
    auth/                      登录注册表单与页面外壳
    studio-shell.tsx           工作台外壳（顶栏 + 侧栏 + 移动导航）
    ui/                        Button、Modal、Field、Toast、Menu 等原语
    library/                   书架视图、新建作品与整书导入
    work/                      作品详情、卷章管理、成员卡片与书封选择
    editor/                    编辑器工作区、大纲、AI 面板、故事设定、插画管理
    reader/                    设备、平台皮肤、分页器、设置、插画 figure
    book-cover.tsx             图片书封与平涂书封的统一渲染
  lib/
    db.ts                      连接、schema、迁移、种子数据
    auth.ts                    注册、登录、密码哈希、会话与页面/API 鉴权
    permissions.ts             角色等级与作品/章节成员查询
    queries.ts                 全部 SQL 读操作（按账号隔离）
    mutations.ts               全部 SQL 写操作、角色校验、整书导入
    export-html.ts             自包含单文件网页渲染、转义与安全色
    http.ts                    API 错误映射
    types.ts                   领域类型
    constants.ts               状态、导航、书封/设定/头像色、角色文案
    words.ts                   字数口径
    platforms.ts               五个平台的设计参数
    illustration-image.ts      插画客户端缩放与压缩
    utils.ts                   日期、类名、文件名
    ai.ts                      AI 服务商适配
  hooks/
    use-autosave.ts            自动保存状态机
```

规则：

- 组件不直接访问数据库；server page 调用 `queries`，route handler 调用 `mutations`。
- 共享的纯函数不得导入服务端模块（`node:sqlite`、`fs`、`node:crypto`）。
- 页面与 API 必须先确定当前账号；`queries` 的每个作品读函数都接收 `userId`，不允许无账号的全量读取。
- 平台皮肤只允许出现在 `lib/platforms.ts` 与 `components/reader/*`。
- 书封、设定识别色与账号头像色是用户数据，只能来自 `lib/constants.ts` 的调色板；界面样式仍使用语义令牌。
- 插画二进制不得进入 RSC 载荷或客户端状态；页面只取元数据与 `/api/illustrations/[id]/image` URL。
- 页面级色彩必须使用语义令牌。

---

## 4. 数据流

### 4.1 读取

```
Request
  -> requireUser()（无会话 redirect /login）
  -> queries.listWorks / getWorkDetail / getEditorBundle / getReaderWork(workId, userId)
  -> 非成员返回 null（页面 404）
  -> 序列化 props
  -> Client Component 渲染
```

M1 所有读库页面设置 `dynamic = "force-dynamic"`，避免构建期快照过期。除登录页外，页面都在服务端先确定账号，未登录不进入组件树。

### 4.2 写入

```
Client 事件
  -> fetch POST/PATCH
  -> requireApiUser()（无会话 401）
  -> route handler 校验输入
  -> mutations（事务：requireWorkRole / requireChapterEditor）
  -> JSON { ... }
  -> router.refresh() 或本地乐观更新
```

服务端为唯一事实源；客户端状态只保存「正在编辑的内容」。角色不足返回 403，非成员或无作品返回 404；两者不可混用。

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

### 4.5 章节插画

```
选择文件（JPEG/PNG/WebP，原始 ≤20 MB）
  -> prepareIllustrationFile：等比缩到最长边 1400
  -> Canvas 编码 WebP（质量 0.86 递减到 0.5，目标 ≤1,400,000 字符）
  -> 浏览器不支持 WebP 时退回 JPEG 白底
  -> POST /api/chapters/:id/illustrations { paragraph, caption, image, width, height }
  -> 服务端校验 data URL、文件头、尺寸、锚点、图注、章节与作品归属
  -> chapter_illustrations（元数据 + BLOB）
  -> 列表只返回 metadata + /api/illustrations/:id/image
  -> 阅读器按钳制后的锚点插入 figure；图片 onLoad 后重测页数
```

- 插画与正文分表：`chapters.content` 不出现图片标记，字数、段落数、版本快照与导出都不受影响。
- 新建、改锚点/图注、删除均不更新 `chapters.updated_at` / `works.updated_at`，因此不会改变自动保存的 `baseUpdatedAt`，也不会触发 409。
- 锚点是段落序号：`0` 表示标题与第一段之间，`N` 表示第 N 段之后。正文变短时读取端钳制，图片仍可显示，不会被删除。
- 编辑只接受 `paragraph` 与 `caption`；图片不能原地替换，换图走删除后新建，避免破坏缓存与版本语义。
- 图片路由仅对未删除章节、未归档作品返回内容，响应 `Cache-Control: private, max-age=31536000, immutable`；删除后立即 404。
- TXT / Markdown 导出只遍历章节正文，插画不会进入；网页 HTML 导出会把插画内嵌为 data URI，JSON 备份存 base64。三者用途不同，互不替代。

### 4.6 账号与会话

```
注册：handle 规范化 -> 校验密码 -> scrypt(password, salt) -> users
     -> 若 users 表此前为空：把 local-user 的作品/成员/统计转给新账号，再删 local-user
     -> 创建会话
登录：handle 查用户 -> timingSafeEqual(scrypt(password, salt), hash) -> 创建会话
会话：randomBytes(32) base64url -> cookie ink_session
     数据库 sessions.id = SHA-256(token)，expires_at = now + 30d
退出：删除 sessions 行 + 清 cookie
改密：requireApiUser -> 校验当前密码 -> 拒绝与旧密码相同
     -> scrypt(newPassword, newSalt)
     -> transaction：更新 users；删除该账号除当前会话外的全部 sessions
```

- `handle` 统一小写并去掉前导 `@`，3–24 位 `[a-z0-9_]`；密码 8–128 位。
- 密码哈希为 scrypt（64 字节），每账号 16 字节随机盐；登录失败统一返回「账号或密码不正确」，不区分账号是否存在。
- 会话 cookie：`httpOnly`、`sameSite=lax`、`path=/`、30 天。当前本机 HTTP 环境不设 `secure`；公网部署必须启用 HTTPS 与 `secure`，并补 CSRF 防护。
- 首个账号接管演示数据是迁移策略，不是权限规则：只在 `users` 表为空时发生一次；此后的账号从空书架开始。
- 注册对作者与读者同等开放；账号本身不带角色，角色只在具体作品的 `work_members` 中生效。读者注册后由作品所有者按 handle 邀请。
- 改密必须提交当前密码；成功后保留发起改密的会话，删除该账号其他所有会话，避免旧令牌继续有效。旧密码立即失效，登录失败提示与注册一致。
- 没有邮箱、找回密码、删除账号或第三方登录；这些能力在 M5 云端阶段再设计。忘记密码仍需数据库管理员处理。

### 4.7 作品成员与权限

```
读取：requireUser -> queries 以 INNER JOIN work_members 过滤 -> 非成员 null -> 404
写入：requireApiUser -> mutations.requireWorkRole(workId, userId, minimum)
                     或 requireChapterEditor(chapterId, userId)
     -> 无成员 404 / 角色不足 403
```

| 操作 | 最低角色 |
| --- | --- |
| 查看作品、预览、设定、插画、导出 | reader（任意成员） |
| 新建/修改卷、章节、保存正文、设定与插画 CRUD、作品资料 | editor |
| 邀请成员、调整角色、移除成员、归档作品 | owner |

- 角色等级集中在 `lib/permissions.ts`：owner 3 / editor 2 / commenter 1 / reader 0。
- author 的 owner 记录不可改角色、不可移除；邀请对象必须已在本机注册。
- commenter 为批注功能预留，当前没有批注写入路径，因此与 reader 一样只读。
- 服务端在每次请求重新查成员关系，移除或降级立即生效；不把角色写进长期 cookie 或客户端缓存。
- 页面按角色隐藏操作，仅用于体验；不构成安全边界。

### 4.8 整书导出、网页导出与导入

```
导出 JSON：GET /api/works/:id/export?format=json
  -> getWorkArchive(workId, userId)（任意成员）
  -> { app, version, exportedAt, work, storyEntities, volumes[chapters[illustrations]] }
  -> 插画 BLOB -> base64；Cache-Control: no-store

导出 HTML：GET /api/works/:id/export?format=html
  -> getWorkArchive(workId, userId)（任意成员）
  -> buildWebPage(archive)：目录、卷章正文、书封与插画
  -> 所有文本 escapeHtml；图片仅接受 jpeg/png/webp data URL
  -> text/html; charset=utf-8 + Content-Disposition attachment
  -> CSP: default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'

导入：POST /api/works/import（正文为 JSON）
  -> requireApiUser
  -> 限制请求字符数 -> JSON.parse -> 校验 app/version
  -> 逐层校验作品、卷、章、设定、插画；限制条目数
  -> transaction：新 works + owner 成员 + volumes + chapters + illustrations + entities
  -> 201 { workId, chapterCount, illustrationCount }
```

- 归档版本 `app = "inkdock"`、`version = 1`；未知版本拒绝，避免静默读错字段。
- 导入**只新建**作品，归属当前账号；不合并、不覆盖、不修改既有作品。`work.authorName` 仅作备份说明，导入不使用。
- 卷/章/设定/插画的所有权来自新作品，不接受归档中的旧 ID；重新生成 UUID。
- 空归档会补「第一卷 / 第一章」；没有任何卷的归档不会被拒绝为空书。
- 单次上限：请求 ≤120,000,000 字符；200 卷；5000 章；600 张插画；2000 条设定；单章正文 ≤2,000,000 字符；单图解码 ≤1,150,000 字节。
- 导入是单事务；任何章节、设定或插画校验失败都会回滚，不留下半本书。
- TXT / Markdown 导出仍只含正文；JSON 才是含书封、设定与插画的无损备份。
- 网页导出是阅读副本：含目录、正文、书封与插画，不包含故事设定、版本、成员或写作统计，也不可重新导入。
- 网页导出不再单独读取图片接口，而是复用 `getWorkArchive` 已加载的 base64；因此文件可离线打开，无外部请求。
- 网页渲染全部走字符串拼接而非 React，必须显式转义；`safeColor` 只接受 `#RRGGBB`，避免把用户色值注入样式。
- 网页响应带严格 CSP，禁止脚本、表单、外部图片与字体；下载文件名同时提供 ASCII 回退与 `filename*`。HTML 条目经成员校验，只读读者同样可用。

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
| 增量（已交付） | 本机账号、会话、作品成员、角色 | 单机访问边界；非成员 404、角色不足 403；不是实时协作 |
| M2 | 邀请码、批注、回收站 | 评论角色开始有实际写入路径 |
| M3 | 章节操作日志 + 在线状态 | 可审计；非实时 |
| M3+ | Yjs CRDT + WebSocket | 正文实时协同；SQLite 存快照 |
| M5 | Postgres + 对象存储 + 队列 + 云端账号 | 多实例部署、跨设备、审计、备份 |

升级原则：正文的权威历史始终是版本快照；CRDT 增量只是运行态，定期物化为纯文本快照，避免锁定单一协同引擎。

---

## 7. API 契约

所有写接口要求 `Content-Type: application/json`，返回 JSON。错误格式统一：

```json
{ "ok": false, "code": "invalid", "error": "书名不能为空" }
```

| 方法 | 路径 | 用途 | 关键校验 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 注册并建立会话 | 账号格式与唯一性；密码 8–128；首个账号接管演示数据 |
| POST | `/api/auth/login` | 登录 | handle + 密码；统一失败提示；创建 30 天会话 |
| POST | `/api/auth/logout` | 登出 | 删除当前会话并清 cookie |
| POST | `/api/auth/password` | 修改密码 | 登录；校验当前密码；新密码 8–128 且不同；保留当前会话，删除其他会话 |
| GET | `/api/works` | 作品列表 | 仅返回当前账号为成员的未归档作品 |
| POST | `/api/works` | 新建作品 + 第一卷 + 第一章 | 登录；书名 1–60；目标字数 0–10,000,000；书封格式与大小 |
| POST | `/api/works/import` | 整书 JSON 导入 | 登录；归档版本、条目上限、图片校验；单事务新建 |
| GET | `/api/works/:id/members` | 成员列表 | 任意成员 |
| POST | `/api/works/:id/members` | 按账号邀请成员 | owner；账号存在；角色为 editor / commenter / reader |
| PATCH | `/api/works/:id/members/:userId` | 调整成员角色 | owner；作者 owner 不可改；目标必须已是成员 |
| DELETE | `/api/works/:id/members/:userId` | 移除成员 | owner；作者 owner 不可移除 |
| PATCH | `/api/works/:id` | 更新资料/状态/书封 | editor；字段白名单；封面可置空 |
| DELETE | `/api/works/:id` | 归档 | owner；软删除 |
| POST | `/api/works/:id/volumes` | 新建卷 | editor；标题 1–60 |
| PATCH | `/api/volumes/:id` | 更新卷 | editor；归属 |
| DELETE | `/api/volumes/:id` | 删除卷 | editor；必须为空卷 |
| POST | `/api/works/:id/chapters` | 新建章节 | editor；卷属于该作品 |
| PATCH | `/api/chapters/:id` | 自动保存 / 状态 / 移动 | editor；乐观锁；标题 ≤ 120；正文 ≤ 2 MB |
| DELETE | `/api/chapters/:id` | 软删除章节 | editor；可为空卷 |
| GET | `/api/chapters/:id/revisions` | 版本列表 | editor；不含正文，避免大响应 |
| POST | `/api/chapters/:id/revisions` | 手动快照 / 恢复 | editor；`{ action: "snapshot" }` 或 `{ action: "restore", revisionId }` |
| GET | `/api/works/:id/story-entities` | 设定列表 | 任意成员；只返回未归档作品 |
| POST | `/api/works/:id/story-entities` | 新建设定 | editor；类型枚举；名称 1–60；摘要 ≤300；详细 ≤6000 |
| PATCH | `/api/story-entities/:id` | 更新设定 | editor；归属未归档作品；字段白名单 |
| DELETE | `/api/story-entities/:id` | 删除设定 | editor；硬删除；不影响作品时间与正文 |
| POST | `/api/chapters/:id/illustrations` | 新建插画 | editor；图片 MIME/文件头/字符与解码上限；锚点 0–10000；图注 ≤120 |
| PATCH | `/api/illustrations/:id` | 改插画锚点/图注 | editor；归属未删除章节；字段白名单；不改图片 |
| DELETE | `/api/illustrations/:id` | 删除插画 | editor；硬删除；返回 404 后不再可读图 |
| GET | `/api/illustrations/:id/image` | 插画二进制 | 任意成员；未删除章节且未归档作品；长期私有缓存 |
| GET | `/api/works/:id/export?format=txt\|md\|html\|json` | 导出 | 任意成员；格式枚举；HTML 为自包含阅读副本，JSON 为无损备份；文件名安全化 |
| GET | `/api/ai/assist` | 配置状态 | 登录；不返回密钥 |
| POST | `/api/ai/assist` | 生成建议 | 登录；动作枚举；客户端提供上下文；正文截断；超时 |
| PATCH | `/api/me` | 修改笔名 | 当前账号；1–24 字 |

仅 `/api/auth/register` 与 `/api/auth/login` 公开；其余接口（含 `/api/auth/logout` 与 `/api/auth/password`）都要求有效会话。作品相关接口在查询或写入层按 `work_members` 校验角色：无成员关系 404，角色不足 403。AI 接口本身不读取作品存储，上下文由客户端提交，因此只校验登录与输入长度；它不会因角色而泄露服务端数据。

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

### 7.2 插画接口细节

新建请求体：

```json
{
  "paragraph": 12,
  "caption": "第七码头在雾里只剩一盏灯。",
  "image": "data:image/webp;base64,...",
  "width": 1400,
  "height": 933
}
```

- `image` 只接受 `data:image/(jpeg|png|webp);base64,`；字符数 >1,600,000 或解码 >1,150,000 字节返回 413 `illustration_too_large`；文件头不匹配返回 400 `invalid_illustration`。
- `paragraph` 必须是 0–10,000 的整数；缺省为 0，非法返回 400 `invalid`。保存的是原始段落序号，读取时再按当前段落数钳制。
- `caption` 去首尾空白后截到 120 字；`width` / `height` 必须是 1–10,000 的整数。
- 新建成功后返回 201 与完整插画元数据；图片不会以 base64 返回。
- 更新只接受 `paragraph` 与 `caption`；省略字段保留原值。删除为硬删除。
- 图片读取失败统一 404 `not_found`，不区分「不存在」与「已删除」。

### 7.3 整书归档格式 `inkdock/1`

```json
{
  "app": "inkdock",
  "version": 1,
  "exportedAt": "2026-10-23T09:30:00.000Z",
  "work": {
    "title": "雾港来信",
    "subtitle": "潮水会替人保守秘密，也会把秘密送回来。",
    "description": "……",
    "genre": "悬疑",
    "status": "serializing",
    "coverColor": "#2F4B46",
    "coverImage": "data:image/jpeg;base64,...",
    "targetWords": 480000,
    "authorName": "沈砚"
  },
  "storyEntities": [
    {
      "type": "character",
      "name": "许砚",
      "subtitle": "回到雾港的长子",
      "summary": "……",
      "description": "……",
      "color": "#3D6B5A"
    }
  ],
  "volumes": [
    {
      "title": "第一卷 潮声",
      "summary": "回到雾港，收到两封没有署名的信。",
      "chapters": [
        {
          "title": "第一章 末班渡轮",
          "status": "published",
          "content": "纯文本正文……",
          "illustrations": [
            {
              "paragraph": 12,
              "caption": "第七码头在雾里只剩一盏灯。",
              "mime": "png",
              "width": 1400,
              "height": 933,
              "data": "iVBORw0KGgo..."
            }
          ]
        }
      ]
    }
  ]
}
```

- `app` 与 `version` 必填；不匹配返回 400 `invalid_archive`。`exportedAt` 仅供备份说明，导入不使用。
- `work.status` 必须是 serializing / completed / paused；`genre` 若提供必须属于既有题材列表，省略或空串按「其他」；`coverColor` 必须是 `#RRGGBB`。
- `coverImage` 可为 `null`；字符串必须是带正确文件头的 JPEG / PNG / WebP data URL，上限与作品封面一致（1,100,000 字符 / 700,000 解码字节）。
- 卷、章、设定按归档顺序重建；`sort` 由服务端重新分配，不信任归档中的 ID 或排序。
- 插画 `mime` 为 `jpeg` / `png` / `webp`；`data` 为纯 base64，不带 data URL 前缀；服务端重新拼装并校验文件头、宽高、解码字节与上限。
- 归档中的 `authorName` 只作为备份说明，导入时忽略；新作品所有者是当前登录账号，不沿用旧作者关系。
- 导出由任意成员触发；导入由任意登录账号触发，生成的作品归导入者所有。

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
- 插画按钳制后的段落锚点分组，渲染为段落后方的 `figure`：宽度占满栏宽，最大高度为正文可视高度的 60%，`break-inside: avoid`。
- 图片写入 `width` / `height` 预留宽高比；`onLoad` / `onError` 触发一次重测，页数随之收敛。图片加载前的页数只作临时值，不作为验收依据。

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

- 当前是本机多账号工具，不是公网多租户服务。`data/*.db` 已加入 `.gitignore`。
- 密码使用 scrypt + 16 字节随机盐；校验使用 `timingSafeEqual`。会话令牌 32 字节随机量，数据库只存 SHA-256 哈希。改密重新生成盐与哈希，并在同一事务内删除其他会话。
- 会话 cookie 为 `httpOnly`、`sameSite=lax`、30 天；本机 HTTP 不设 `secure`。公网部署前必须启用 HTTPS、`secure`、CSRF/Origin 校验、登录限流、密码恢复与备份策略。
- 所有 SQL 使用参数绑定。
- 每个作品读函数接收 `userId` 并由 `work_members` 过滤；写接口在事务前调用 `requireWorkRole` 或 `requireChapterEditor`。
- 无成员关系返回 404，角色不足返回 403；移除成员或降级后，下一次请求立即生效。
- 写接口做字段白名单与长度限制，防止超大正文拖垮进程；整书导入额外限制条目数量与单图/单章大小。
- 插画以 BLOB 存储前再次校验 MIME 前缀、Base64、解码字节与文件头；图片读取按章节/作品状态过滤，避免软删除后泄露。
- React 默认转义；不渲染 Markdown/HTML。网页导出不经 React，因此由 `export-html.ts` 显式转义 `& < > " '`，并对颜色使用白名单。
- 网页导出只接受 JPEG / PNG / WebP data URI；响应 `Content-Security-Policy` 限制为内联样式与 data 图片，禁止脚本、表单、外部请求；文件以附件下载。
- 导出文件名去除控制字符与路径分隔符，并同时构造 ASCII 回退与 `filename*`；JSON 与 HTML 导出均 `Cache-Control: no-store`。
- 当前没有账号删除、找回密码、邮箱验证与第三方登录；改密仅在已登录状态可用，这些缺口必须如实说明。

---

## 11. 性能与容量

| 场景 | 目标 | 手段 |
| --- | --- | --- |
| 书架查询 | < 50 ms / 100 本书 | 聚合子查询 + 索引 `works(updated_at)`、`chapters(work_id)` |
| 章节打开 | < 100 ms | 单次 bundle 查询，按 work_id 取卷章 |
| 自动保存 | < 30 ms | 单事务 + WAL；正文大小上限 2 MB |
| 插画写入 | 单张 ≤1.15 MB | 客户端先压缩；单行 INSERT；不参与正文事务 |
| 插画加载 | 不阻塞编辑 | 元数据与二进制分离；宽高预留；长期私有缓存 |
| 分页 | < 50 ms | 一次布局测量；不在滚动中计算 |
| 编辑器输入 | 无可感知延迟 | 本地 state；防抖写库；不依赖服务端往返 |

容量目标（M1）：500 本书、50,000 章、2 GB 正文；插画单图 ≤1.15 MB，按 300 张估算额外 ≤345 MB。超出后迁移服务端数据库与对象存储。

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
| 接口 | 自动保存、冲突、卷删除约束、书封校验、设定 CRUD、插画校验与图片路由、账号与会话、改密会话轮换、成员角色、整书往返、HTML 转义与读者导出 | 集成测试 |
| E2E | 后续 Playwright：新建→写→刷新→预览翻页；插画上传→锚点→预览分页；双账号邀请→只读/编辑→移除；整书导出→导入；网页导出→打开→图片加载 | M2 |

当前书封与设定的端到端证据来自 `.shots/verify-options.mjs`：真实上传、刷新持久化、书架渲染、设定新建/编辑/筛选/详情/删除、390 宽抽屉无溢出。插画证据来自 `.shots/verify-illustrations.mjs`：真实 CDP 文件上传、客户端压缩、默认光标锚点、改锚点与图注、图片接口 MIME/缓存/字节、删除后 404、预览中的段落位置与 3 页分页、键盘翻页后仍可见、390 宽无溢出。多账号证据来自 `.shots/multiuser-visual.mjs` 与配套 API 探测：首账号接管演示数据、第二账号空书架、非成员 404、读者只读、编辑可写但不可管理成员、移除后 404、整书 JSON 导出再导入、1440 / 390 截图无横向溢出。网页导出与改密证据来自 `.shots/verify-account-export.mjs`、`.shots/verify-web-visual.mjs` 与 `.shots/verify-export-media.mjs`：所有者与读者均可下载 HTML、封面与插画实际加载、XSS 文本被转义、无脚本与渐变、1440 / 390 无横向溢出；深色媒体切换为深底浅字，打印媒体隐藏目录与返回链接；改密后当前会话保留、其他会话 401、旧密码失效、新密码可登录且测试后已恢复。这些脚本与截图属于本地验收工具，不随仓库分发。

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
| 本机账号无找回 | 忘密码后无法登录 | 登录页明确提示；保留整书 JSON 备份；后续补管理员重置 |
| 公网直接暴露 | 会话与数据被跨站利用 | 文档明确本机边界；公网前补 HTTPS、secure cookie、CSRF/Origin 与限流 |
| 整书导入体量过大 | 内存与事务占用过高 | 120 MB 字符与条目上限；解析前拒绝；后续改流式导入 |

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
- **ADR-009**：章节插画按段落锚定并独立建表，不写入正文。正文保持纯文本与既有保存协议；段落变动时读取端钳制锚点，不需要文本迁移或版本重写。
- **ADR-010**：插画元数据与 BLOB 分离，二进制走独立图片路由。RSC 只传 URL，页面载荷不随图片增长；代价是删除与缓存需要按图片 ID 管理，换图必须删除后重建。
- **ADR-011**：本机账号只存 handle + scrypt 密码哈希，不引入邮箱与第三方身份。它解决同一台机器上的访问边界，代价是没有找回能力，公网化时必须整体升级为云端认证。
- **ADR-012**：角色校验放在 queries / mutations，而非仅靠页面门控。读函数接收 `userId` 并由成员表过滤，写函数统一 `requireWorkRole`；这样新增页面或接口不会绕过权限。
- **ADR-013**：整书迁移使用带版本号的 JSON，导入只新建作品并整体事务化。选择「备份/迁移」而不是「同步/合并」，避免覆盖既有作品与产生难以解释的冲突。
- **ADR-014**：网页导出采用服务端拼接的自包含 HTML，而不是把预览页打包成站点。它无需服务器、无外部依赖，可直接分享与离线打开；代价是排版逻辑与阅读器分离，需单独维护并与正文段落规则保持一致。
- **ADR-015**：网页导出使用严格 CSP 与显式转义，而不是信任前端模板。导出文件会离开应用边界，必须在生成时保证不含脚本或外部资源。
- **ADR-016**：改密保留当前会话、轮换其余会话。用户不会在改密后被立即登出，但旧密码与旧令牌不能继续使用；这是本机账号在缺少找回机制下的最低安全闭环。
