# AGENTS.md · 墨坞 Inkdock

本文件是任何后续开发者或 AI 代理进入本项目的第一入口。先读本文件，再读 `docs/`。当上下文被压缩或会话更换时，以本文件与 `docs/05-context-handoff.md` 为准。

---

## 1. 项目是什么

**墨坞 Inkdock**：本地优先的小说创作与协作工作台。中文界面，纯文本正文，分书、分卷、分章，自动保存，内置安卓手机预览与五个主流阅读平台排版模拟（含真实分页翻页）。书封、故事设定、章节插画、本机多账号、作品成员角色、账号安全、整书 JSON 迁移与单文件网页导出均已交付。长期目标是加入批注、实时协作与 AI 增强。

当前状态：**M1 已完成（2026-10-22）**；**书封、故事设定、章节插画、本机多账号、整书导入导出、网页导出、改密与读者注册引导已交付（2026-10-23）**。下一里程碑是 **M1.5**（手感打磨），尚未开工。范围与验收见 [docs/04-roadmap.md](docs/04-roadmap.md)。

## 2. 不可违反的约束

1. **不使用任何 CSS 渐变**（`linear-gradient`、`radial-gradient`、`conic-gradient`）。
2. **不使用 emoji**，界面、种子文案、文档、代码注释均不出现。
3. 视觉语言是**安卓原生式胶囊**：完整圆角按钮、分段控件、平涂色块、细线、留白。不要退回小圆角卡片或玻璃拟态。
4. 颜色只能通过 `src/app/globals.css` 的语义令牌；平台品牌色只能集中在 `src/lib/platforms.ts` 与阅读器组件。
5. 数据存 SQLite（`node:sqlite`，WAL），不引入远程数据库或 ORM，除非完成 M5 迁移设计。
6. 正文是纯文本，不引入富文本编辑器、Markdown 渲染或 HTML 存储。
7. 自动保存不得静默覆盖冲突；不得移除本地草稿兜底。
8. 不伪造功能：AI 未配置时明确提示；平台模拟标注「界面模拟，非官方客户端」；未实现的能力不放假入口。
9. UI 文案使用中文，代码标识符与注释使用英文。
10. 代码注释遵循：英文；需要说明「为什么」而非「做什么」；新建的主要源码文件顶部保留 `// Author: yxpil`。
11. 未经用户明确要求，不执行 `git commit` / `git push`，不修改 git 配置。
12. 书封只接受 JPEG / PNG / WebP data URL，解码后不超过 700 KB；不接受远程 URL、SVG 或未经校验的文件内容。
13. 故事设定按作品隔离，可硬删除；设定只用于写作参考，不得写入正文、手机预览、TXT / Markdown 或网页导出。只有整书 JSON 备份包含设定。
14. 书封底色、设定识别色与账号头像色属于用户数据，集中在 `src/lib/constants.ts`；覆盖其上的文字必须使用 `--on-cover` 令牌。
15. 章节插画按段落锚定、独立存表，不写入正文；TXT / Markdown 导出仍只含文字。
16. 插画只接受 JPEG / PNG / WebP 且必须校验文件头；图片不改变字数、段落数、版本快照或章节/作品编辑时间。
17. 账号仅本机：密码用 scrypt + 每账号随机盐存储；会话令牌只存 SHA-256 哈希，cookie 为 httpOnly + sameSite=lax，有效期 30 天。不得记录明文密码或原始令牌。
18. 所有作品读写必须按 `work_members` 校验角色；无成员关系返回 404，角色不足返回 403。不得用前端隐藏代替服务端校验。
19. 角色固定为 owner / editor / commenter / reader；只有所有者能管理成员，作者的所有者角色不可改、不可移除。
20. 整书 JSON 导入只能新建作品，归属当前导入者，绝不覆盖已有作品；导入在单事务内完成，任一条目失败则整体回滚。
21. 整书 JSON 导出包含书封、设定与插画，属于无损备份；TXT / Markdown 仍只导出正文。不得把设定或插画混入纯文本导出。
22. 单文件 HTML 导出必须转义全部用户文本、内嵌封面与插画、不包含脚本；不导出故事设定与写作数据，不使用渐变或外部资源。
23. 修改密码必须校验当前密码；成功后保留当前会话、清除该账号其他会话。不得记录明文密码，也不得用前端校验代替服务端校验。

## 3. 技术与命令

- Next.js 16 App Router、React 19、TypeScript strict、Tailwind CSS 4、lucide-react。
- Node 24+（使用内置 `node:sqlite`）。
- 数据库：`data/inkdock.db`（自动创建，已 gitignore；schema v4）。
- 开发：`npm run dev`（http://localhost:3000）
- 类型：`npm run typecheck`
- 构建：`npm run build`
- 环境变量（可选，AI）：`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`。
- 首次打开会跳转 `/login`；第一个注册的账号自动继承 M1 的无密码演示数据（两本示例作品与统计），之后注册的账号从空书架开始。

## 4. 目录与数据边界

- `src/app/**/page.tsx`：服务端取数（`lib/queries.ts`），设置 `export const dynamic = "force-dynamic"`；除 `/login` 外均要求登录。
- `src/app/api/**/route.ts`：写操作（`lib/mutations.ts`），校验登录、输入、归属、角色与冲突。
- `src/lib/auth.ts`：注册、登录、会话 cookie、密码修改、`requireUser` / `requireApiUser`；第一个账号接管演示数据。
- `src/app/api/auth/password/route.ts`：校验当前密码并更新密码，清除其他会话。
- `src/lib/export-html.ts`：单文件网页排版器；内嵌封面与插画、转义正文、生成目录与打印样式。
- `src/lib/permissions.ts`：角色等级与作品/章节成员查询；`mutations.requireWorkRole` 统一拒绝越权。
- `src/lib/queries.ts`：所有读操作接收 `userId`，非成员不返回数据（页面 404）。
- `src/components/auth/auth-view.tsx`：登录与注册共用表单，含本机账号说明。
- `src/components/**`：客户端交互组件。不得导入 `lib/db.ts`、`lib/auth.ts` 或 `node:*`。
- `src/lib/platforms.ts`：五个平台的设计参数与默认排版。
- `src/hooks/use-autosave.ts`：自动保存状态机。修改前先读 [架构文档第 5 节](docs/02-architecture.md)。
- 设计令牌：`src/app/globals.css`。新增颜色先加令牌，再使用。
- `src/components/editor/story-bible.tsx`：故事设定面板与编辑弹窗；桌面停靠、移动端抽屉共用同一状态。
- `src/components/editor/chapter-illustrations.tsx`：插画上传、段落锚点与图注编辑、删除；图片经 `/api/illustrations/[id]/image` 加载。
- `src/lib/illustration-image.ts`：客户端缩放与 WebP/JPEG 压缩；上传前校验类型与大小。
- `src/components/work/cover-image-picker.tsx`：书封选择、4:5 居中裁剪与压缩。
- `src/components/work/work-view.tsx`：按角色门控目录操作、成员卡片与 TXT / Markdown / HTML / JSON 导出；只读成员进入预览而非编辑器。
- `src/components/library/library-view.tsx`：书架、整书导入入口与角色徽标；导入只新建作品。
- `src/components/ui/modal.tsx`：通过 portal 挂载到 `document.body`，避免被抽屉的 transform 定位上下文裁切。

## 5. 数据不变量（摘要）

- 章节必须归属存在的卷；卷必须属于同一作品。
- 每本新书自动创建「第一卷」与「第一章」。
- 章节与作品是软删除；卷只能在无未删除章节时删除，删除卷会级联清除该卷内已归档章节。
- 字数由服务端用 `countWords` 重算；保存时同事务更新作品时间、当日新增字数、版本快照。
- 自动保存携带 `baseUpdatedAt`；不一致返回 409。若迟到的旧请求与当前标题、正文、状态、卷完全一致，则按幂等成功确认，避免崩溃恢复误报冲突。
- 版本快照不可修改；恢复前先快照当前正文。快照/恢复接口已存在，版本历史界面尚未实现（M1.5）。
- 书封存 `works.cover_image`（data URL，可为空）；客户端裁为 800×1000，服务端再次校验大小与文件头。清空封面写 `null`，不改动其他字段。
- 故事设定存 `story_entities`，必须归属未归档作品；类型限定为 character / organization / location / item / concept；删除为硬删除，不影响作品 `updated_at` 与正文。
- 章节插画存 `chapter_illustrations`，按段落序号锚定；图片 BLOB 单独由图片接口返回；CRUD 不改章节/作品时间、不加快照、不计每日字数。TXT / Markdown 与预览正文仍按纯文本处理；网页与整书 JSON 导出包含插画。
- 账号存 `users`（`handle` 唯一，3–24 位小写字母/数字/下划线；密码 8–128 位）；注册对作者与读者开放，账号本身不带角色。会话存 `sessions`，只保存令牌 SHA-256 哈希，过期或登出即删除。修改密码需校验当前密码，成功后清除该账号其他会话。没有邮箱、找回密码或第三方登录；忘记密码只能由数据库管理员直接处理。
- 每个作品在 `work_members` 有且仅有一条作者 owner 记录；非成员访问返回 404，成员角色低于所需等级返回 403。owner 可管理成员；editor 可写作品、卷章、设定与插画；commenter 与 reader 目前都只读（评论功能尚未实现），但可导出 TXT / Markdown / JSON / HTML。
- 单文件 HTML 导出供读者离线打开：含封面、目录、卷章正文与段落锚定插画，全部用户文本经 HTML 转义，不包含脚本、故事设定或写作数据；TXT / Markdown 仍只含正文。
- 整书归档版本为 `inkdock/1`：作品资料、书封、故事设定、卷章正文与插画（base64）。导入上限 120,000,000 字符、200 卷、5000 章、600 张插画、2000 条设定；单章正文沿用 2,000,000 字符上限，单图解码 ≤1,150,000 字节。导入生成新作品与新 owner，不合并、不覆盖、不改动原作者字段。
- 作者、成员与作品的删除关系：作品归档为软删除；移除成员立即失去访问；成员关系与作品一起级联删除。`users` 当前没有删除入口。

完整定义见 [docs/03-data-model.md](docs/03-data-model.md)。

## 6. 工作方式

- 先读 `docs/05-context-handoff.md` 的「当前状态」和「下一步」。
- 一次只推进一个 backlog 任务；完成一个就更新状态。
- 修改 UI 后必须在浏览器中检查 1440 宽与 390 宽，而不是只看代码。
- 里程碑收尾运行 `npm run typecheck` 与 `npm run build`。
- 任何接口、schema、状态、设计令牌变化，同批更新对应文档。
- 不扩大范围：新想法写入 `docs/04-roadmap.md` 的 backlog，不在当前任务里顺手实现。
- 代码风格：函数短小、显式类型、错误文案可行动、避免无意义抽象。
- 不创建与任务无关的 README/说明文件。

## 7. 当前优先级

1. M1.5 第一项：版本历史界面（列表、只读预览、恢复前快照）。
2. 章节拖拽排序与跨卷移动、全文查找替换、打字机模式。
3. 把 `.shots/verify*.mjs` 与 `.shots/multiuser-visual.mjs` 的核心场景固化为正式 E2E。
4. 有可用密钥时补验 AI 真实生成；无密钥时保持「未配置」诚实降级。
5. 协作深化进入 backlog：邀请码、批注、在线状态与实时协作；评论角色在评论功能落地前保持只读。
6. 公网部署前必须补 CSRF/Origin 防护、速率限制、HTTPS 与 secure cookie、备份与账号恢复策略。
7. 插画替换、跨章画廊与 EPUB / PDF 导出属于 backlog（M4），不在当前任务里顺手实现；带图分享已由单文件 HTML 导出承担。

## 8. 上下文压缩后的恢复步骤

1. 读本文件。
2. 读 `docs/05-context-handoff.md`。
3. 读 `docs/04-roadmap.md` 的「当前待办」。
4. 查看 `TaskList` 中未完成任务。
5. 直接运行 `npm run dev`，按当前页面实测，不凭记忆修改。
