# 墨坞 Inkdock · 上下文交接

版本：1.4  
更新：2026-10-23  
适用状态：**M1 已完成；书封、故事设定、章节插画、本机多账号、整书迁移、网页导出与改密已交付；M1.5 尚未开工**

本文是会话中断、上下文压缩或开发者更换后的恢复锚点。先读 `AGENTS.md`，再读本文，最后读 `docs/04-roadmap.md` 的任务板。

---

## 1. 一句话现状

本机多账号写作工作台已经可用：书架、分卷分章、编辑器自动保存、本地草稿恢复、五平台阅读预览、真实分页翻页、TXT/Markdown 导出均已实现并在真实 Chrome 中验收。2026-10-23 追加自定义书封、五类故事设定、按段落锚定的插画，本机账号、作品成员四级角色、整书 JSON 导入导出，以及单文件网页导出、设置页改密与读者注册引导。下一阶段是 M1.5 手感打磨，第一优先级是版本历史界面；实时协作仍是后续里程碑。

---

## 2. 已验证基线（2026-10-23）

验证环境：Windows、Node 24、Chrome 无头模式 + CDP 真机尺寸模拟；桌面 1440、平板 768、手机 390。验证脚本为 `.shots/verify.mjs`、`.shots/verify-management.mjs`、`.shots/verify-story.mjs`、`.shots/verify-options.mjs`、`.shots/verify-illustrations.mjs`、`.shots/multiuser-visual.mjs`、`.shots/verify-account-export.mjs`、`.shots/verify-web-visual.mjs`、`.shots/verify-export-media.mjs`（本地临时验收工具，`.shots/` 已 gitignore，不属于应用代码）。多账号、网页导出与改密验收使用独立数据库 `.shots/multiuser.db`，未改动默认演示库中的账号数据。

| 场景 | 结果 |
| --- | --- |
| 输入后 900 ms 防抖保存 | 显示「已保存」，SQLite 正文与字数一致，本地草稿清理 |
| 刷新页面 | 正文与字数持久化 |
| 断网输入 | 显示「离线，已存本机」，localStorage 草稿存在 |
| 恢复网络 | 自动补交，服务端持久化 |
| 外部改写造成 409 | 出现冲突提示；「保留本地并覆盖」后落库 |
| 输入后立即刷新（崩溃模拟） | 出现恢复提示；「载入草稿」后可保存 |
| UI 新建作品 | 重定向到编辑器；自动生成 1 卷 1 章，首章标题「第一章」 |
| 书架筛选与搜索 | 空状态正确；搜索「采石」命中 1 张卡片 |
| 继续写作 | 书架链接指向最近编辑章节「第五章 第七码头」 |
| 阅读器翻页 | 左右方向键、右侧点击、触摸滑动（2 → 3 → 2）均有效 |
| 分页重排 | 字号 18 → 26：4 → 7 页；行高 1.9 → 2.2：48 → 57 页；页边距窄 → 宽：48 → 51 页（长文夹具） |
| 五平台切换 | 起点、番茄、晋江、微信读书、七猫的页眉、页脚、URL、品牌参数均不同 |
| 跨章翻阅 | 末页进入下一章；首翻回到上一章末页（4 / 4） |
| 手机 390 布局 | `innerWidth = scrollWidth = 390`，无横向溢出 |
| 导出 | TXT 200、Markdown 200；清理夹具后 TXT 3451 字节 |
| 管理 API | 新建卷、卷内建章、非空卷拦截、状态切换、删章、删空卷、最后一卷拦截、作品改名/归档 |
| 书封上传 | 161,835 字符 JPEG data URL 落库；刷新、作品页、书架均显示；移除后恢复底色版式 |
| 书封校验 | 非图片 / 错误文件头被 400 拒绝；超大负载被 413 拒绝；省略封面保留、`null` 清空 |
| 故事设定 CRUD | 五类设定新建、编辑、搜索、类型筛选、详情、删除；无效类型与空名称被拒绝 |
| 编辑器接入 | 1440 右侧标签页与 390 右侧抽屉；新建/编辑弹窗完整覆盖视口；抽屉内容预设 5 条可见 |
| 插画上传与默认锚点 | CDP 注入 PNG 后客户端压缩并新建；默认锚点取光标所在段落（第 3 段之后）；编辑器显示缩略图卡片 |
| 插画编辑与校验 | 图注与锚点可改并持久化；非法图片、错误文件头、越界锚点被 400 拒绝；删除后图片接口 404 |
| 图片接口 | 返回与落库 MIME 一致的二进制、正确字节数与长期私有缓存头；删除插画后返回 404 |
| 插画分页 | 7 段夹具共 3 页；插画渲染在第 2 段之后；键盘翻页后仍可见，图片加载后页数重测稳定 |
| 插画移动端 | 390 宽编辑器、预览与插画弹窗无横向溢出；弹窗完整覆盖视口 |
| 插画数据清理 | 插画验收使用的临时作品已硬删除（当时演示库 `works = 2`、未删除章节 `7`、插画 `0`） |
| 首账号接管演示数据 | 注册第一个账号后自动获得 2 本示例作品与统计，`local-user` 被删除 |
| 第二账号隔离 | 新账号书架为空；直接访问他人作品页、导出、自动保存均 404 |
| 读者权限 | 所有者按账号邀请为 reader；页面无新建/编辑/删除/成员控件，章节进入预览，写作接口 403 |
| 编辑权限 | 改为 editor 后出现写作入口，可新建/删除卷章；成员管理控件仍只对所有者显示 |
| 移除成员 | 所有者确认移除后成员数回到 1；被移除账号再次访问作品页与整书接口均为 404 |
| 整书导出 | 导出 11 KB JSON，含 2 卷 5 章；`Cache-Control: no-store`，文件名安全化 |
| 整书导入 | 另一账号从书架选择备份导入，得到 2 卷 5 章、所有者为自己的新作品，书架出现角色标记 |
| 富归档往返 | 含 1×1 PNG 书封、1 条设定、1 张插画、已完结状态与 480000 目标字数的备份导入后，再导出全部字段保留；Toast 报告 5 章、1 幅插画 |
| 登录页与 404 | 1440 双栏与 390 单栏均完整；未登录跳转 `/login`；无权限作品显示中文 404 |
| 多账号移动端 | 书架、作品页、阅读预览、登录页、404 在 390 宽 `scrollWidth = innerWidth = 390` |
| 网页导出（所有者） | 200 `text/html; charset=utf-8`，附件下载；5 章目录与正文完整，封面与插画以 data URI 内嵌 |
| 网页导出（读者） | 只读读者同样 200；导出不要求编辑权限，仍先校验成员关系 |
| 网页安全 | `<script>` 与 `onerror` 只作为转义文本出现；无脚本标签、无外链、无渐变；响应带严格 CSP |
| 网页渲染 | 封面与插画 `naturalWidth > 0`；1440 / 390 `scrollWidth = innerWidth`，目录对齐 |
| 网页媒体 | 深色媒体：`body` 底色 `rgb(18,19,17)`、文字 `rgb(236,234,227)`；打印媒体：目录与返回链接 `display:none`、卷 `break-before:page`；无脚本、无外链 |
| 改密 API | 当前会话保持 200；另一会话变 401；旧密码登录 401；新密码登录 200；测试后恢复 `write1234` |
| 改密界面 | 设置页账号安全卡片可提交；成功 Toast 显示、三个输入清空；恢复密码接口 200 |
| 读者注册文案 | 登录/注册页与空书架说明读者路径；1440 / 390 无横向溢出 |
| 类型与构建（多账号） | 2026-10-23 多账号与整书迁移实现后 `npm run typecheck` 与 `npm run build` 均通过 |
| 移动端 | 设定抽屉 `scrollWidth = innerWidth = 390`，`panelWidth = 358`，`panelRight = 390` |
| 类型与构建 | 2026-10-23 插画实现后 `npm run typecheck` 与 `npm run build` 均通过 |

验收后默认演示库已迁移到 `PRAGMA user_version = 4`：2 本作品、7 个未删除章节、0 条故事设定、0 张书封、0 张插画、2 条 owner 成员关系；账号表只有无密码的 `local-user`，会话为 0，等待第一个真实注册账号接管。两个多账号验收账号与导入作品只存在于 `.shots/multiuser.db`，未写入默认演示库。网页导出与改密验收只使用该临时库：`inkcap` 与 `lamp` 的密码已恢复为 `write1234`，临时作品与读者成员关系已清理。`npm run typecheck` 与 `npm run build` 最终均通过。

**未验证**：配置真实 AI 密钥后的生成（本机无凭证）；移动 Safari 与真实手机；多进程并发写入；接近 20 MB 的源图在低内存手机上的压缩表现；插画替换（当前需删除后重建）、跨章画廊与 EPUB / PDF 导出；插画在极长章节与多图同页下的分页表现；网页导出在超大作品（数百 MB）下的内存峰值与实际打印分页；跨设备登录、邀请码、忘记密码、账号删除与并发多人写入；公网部署下的 CSRF、限流与 HTTPS 行为。

---

## 3. 运行

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

- Node 必须 >= 24（使用内置 `node:sqlite`）。
- 数据库：`data/inkdock.db`，首次启动自动建表并写入两本示例作品。现在 `user_version = 4`。
- 可用 `INK_DB_PATH` 覆盖数据库路径。多账号验收使用 `.shots/multiuser.db`；不要把它与默认演示库混用。
- 启动后打开 http://localhost:3000 会跳转 `/login`。第一个注册账号会接管 `local-user` 的演示作品、成员关系与统计；第二个及之后的账号从空书架开始。
- 已登录时可在设置页改密；本机账号没有找回密码，忘记密码只能由数据库管理员处理，验收或试用时请保留整书 JSON 备份。
- AI 为可选项：创建 `.env.local` 并设置 `AI_API_KEY`；`AI_BASE_URL` 默认 `https://api.openai.com/v1`，`AI_MODEL` 默认 `gpt-4o-mini`。修改后重启开发服务器。
- 端口冲突时用 `npx next dev -p 3001`，但验收脚本中的 `BASE` 需同步修改。

---

## 4. 代码地图

| 位置 | 职责 |
| --- | --- |
| `src/app/login/page.tsx` | 登录与注册入口 |
| `src/app/library/page.tsx` | 书架服务端取数 |
| `src/app/works/[workId]/page.tsx` | 作品资料与目录（按成员角色） |
| `src/app/write/[chapterId]/page.tsx` | 编辑器入口（仅 owner / editor） |
| `src/app/preview/[workId]/page.tsx` | 手机预览入口（任意成员） |
| `src/app/settings/page.tsx` | 账号与设置页 |
| `src/app/not-found.tsx` | 中文品牌 404 |
| `src/app/api/auth/*` | 注册、登录、登出、改密 |
| `src/app/api/works/import/route.ts` | 整书 JSON 导入 |
| `src/app/api/works/[id]/members/*` | 成员列表、邀请、改角色、移除 |
| `src/app/api/works/[id]/export/route.ts` | TXT / Markdown / HTML / JSON 导出与下载头 |
| `src/app/api/auth/password/route.ts` | 已登录改密与当前会话保持 |
| `src/app/api/**/route.ts` | 其余写接口；所有写操作走 `mutations.ts` |
| `src/app/api/works/[id]/story-entities/route.ts` | 设定列表与新建 |
| `src/app/api/story-entities/[id]/route.ts` | 设定更新与删除 |
| `src/app/api/chapters/[id]/illustrations/route.ts` | 章节插画新建 |
| `src/app/api/illustrations/[id]/route.ts` | 插画锚点/图注更新与删除 |
| `src/app/api/illustrations/[id]/image/route.ts` | 插画二进制输出与长期私有缓存 |
| `src/lib/db.ts` | SQLite 连接、schema、迁移、种子 |
| `src/lib/auth.ts` | 密码哈希、注册登录、改密、会话 cookie、页面/API 鉴权与演示数据接管 |
| `src/lib/permissions.ts` | 角色等级、作品/章节成员查询 |
| `src/lib/queries.ts` | 服务端只读查询与聚合（按账号隔离，含书封、设定、插画与整书归档） |
| `src/lib/mutations.ts` | 事务写入、角色校验、乐观锁、快照、书封/设定/插画校验、整书导入 |
| `src/lib/export-html.ts` | 自包含网页排版、文本转义、安全色与内嵌图片 |
| `src/lib/illustration-image.ts` | 客户端缩放、WebP/JPEG 压缩与上传前校验 |
| `src/lib/words.ts` | 字数口径（前后端共用） |
| `src/lib/platforms.ts` | 五平台排版参数、页眉页脚、品牌色 |
| `src/hooks/use-autosave.ts` | 自动保存状态机、草稿、退避重试 |
| `src/components/auth/auth-view.tsx` | 登录/注册表单与页面外框 |
| `src/components/studio-shell.tsx` | 工作台外壳、当前账号与登出 |
| `src/components/settings/settings-view.tsx` | 账号安全、主题、写作偏好与 AI 状态 |
| `src/components/editor/editor-workspace.tsx` | 编辑器交互总装 |
| `src/components/editor/story-bible.tsx` | 设定列表、详情、搜索筛选与编辑弹窗 |
| `src/components/editor/chapter-illustrations.tsx` | 插画上传、锚点/图注编辑、删除与画廊 |
| `src/components/work/work-view.tsx` | 作品目录、角色门控、成员卡片与导出 |
| `src/components/work/cover-image-picker.tsx` | 书封选择、4:5 裁剪与压缩 |
| `src/components/library/library-view.tsx` | 书架、角色徽标、整书导入与继续写作 |
| `src/components/book-cover.tsx` | 图片/底色书封统一渲染 |
| `src/components/ui/modal.tsx` | portal 弹窗原语，焦点锁定与 Esc 关闭 |
| `src/components/reader/*` | 设备外壳、分页、平台皮肤、阅读设置；按段落插入插画 |
| `src/app/globals.css` | 语义设计令牌与基础样式 |
| `docs/01-design-system.md` | 胶囊设计系统与令牌说明 |
| `docs/02-architecture.md` | 分层、鉴权、保存协议、整书格式、分页与协作演进 |

新增文件若属于主要源码，顶部保留 `// Author: yxpil`；注释一律英文，只解释「为什么」。

---

## 5. 关键实现决定

1. **纯文本正文**：不存 HTML/Markdown；所有平台排版在阅读器中模拟。
2. **自动保存**：900 ms 防抖、20 s 强制、6/12/24 s 退避（封顶 30 s），`baseUpdatedAt` 乐观锁；`pagehide` 写草稿并尝试 `sendBeacon`。
3. **重复保存幂等**：若到达的旧请求与服务端当前标题、正文、状态、卷完全一致，直接按成功确认，不返回 409。这是崩溃恢复与重试不误报冲突的关键。
4. **分页**：CSS multi-column 真实排版。设备宽 393，`columnWidth = 393 - 2 * 页边距`，列间距 `2 * 页边距`；页数按 `scrollWidth` 实测，不按字数估算。
5. **平台记忆**：每个平台独立阅读偏好，存储键由平台 id 区分。
6. **卷删除**：仅当卷内未删除章节数为 0 时可删；删除卷会通过外键级联清除该卷内已软删除的章节及其版本。M1 没有回收站 UI，因此这些章节本就不可见；M2 做回收站时需要重新评估或改为显式清理。
7. **作品与章节软删除**；每本作品至少保留一卷。
8. **AI 只在服务端读密钥**；未配置返回 501 与可行动提示；不自动改写正文。
9. **颜色**只能来自 `globals.css` 语义令牌；平台品牌色例外，集中在 `platforms.ts`；无任何 CSS 渐变、无 emoji。
10. **书封**在客户端裁为 4:5（800×1000）并压成 JPEG，以 data URL 存 `works.cover_image`；服务端再次校验 MIME、长度、解码字节与文件头。无图时渲染平涂底色封面。
11. **故事设定**存独立表 `story_entities`，按作品隔离，五类枚举，硬删除；不进入正文、预览、TXT / Markdown 与网页导出，只有整书 JSON 备份包含；不改动作品 `updated_at`。
12. **编辑器设定面板**在 `xl` 及以上停靠在右栏，与 AI 面板共用分段标签；窄屏为右侧抽屉。桌面与移动共享提升后的列表状态。
13. **弹窗必须 portal**：移动抽屉使用 transform 动画，会形成 fixed 定位上下文；`Modal` 挂载到 `document.body` 才能全屏居中并正确遮罩。
14. **插画不进入正文**：按段落序号锚定，独立存 `chapter_illustrations`。正文改写只需在读取端钳制锚点，不迁移文本、不创建版本。
15. **插画元数据与二进制分离**：RSC 只传元数据与图片 URL，BLOB 由 `/api/illustrations/[id]/image` 返回并设 `private, max-age=31536000, immutable`，避免大 base64 进入页面载荷。
16. **插画 CRUD 不进自动保存协议**：不改 `chapters.updated_at` / `works.updated_at`，不加快照与每日字数，因此不会引发 409 或覆盖草稿。
17. **分页等待图片**：阅读器为图片写入 `width/height` 预留比例，`onLoad` 触发重测；图高上限为正文可视高度的 60%，`breakInside: avoid` 防止跨页截断。
18. **本机账号**：账号 + 密码，密码 scrypt + 16 字节盐；没有邮箱、找回或第三方登录。登录失败统一提示，不暴露账号是否存在。
19. **会话**：32 字节随机令牌放 httpOnly / sameSite=lax cookie；数据库只存 SHA-256 哈希，30 天过期。当前本机 HTTP 不设 secure，公网必须补。
20. **演示数据接管**：首个注册账号一次性继承 `local-user` 的作品、成员与统计，然后删除该账号。它只在 `users` 表为空时发生，之后的账号从空书架开始。
21. **权限在数据层**：读函数接收 `userId` 并由 `work_members` 过滤；写函数统一走 `requireWorkRole` / `requireChapterEditor`。无成员 404、角色不足 403，前端隐藏不作为安全边界。
22. **角色边界**：owner 可管理成员与归档；editor 可写作品、卷章、设定与插画；commenter 与 reader 只读，且都可预览和导出。commenter 为批注预留，当前没有评论 UI。
23. **整书迁移**：JSON `inkdock/1` 含书封、设定、卷章与插画；导入只新建归当前账号所有的作品，单事务，失败整体回滚。TXT / Markdown 仍只含文字。
24. **网页导出**：`format=html` 复用整书归档数据，由 `lib/export-html.ts` 拼接单个自包含页面。目录、正文、书封与插画内嵌；不写库、不生成版本、不含设定与写作数据。任何成员可用。
25. **网页安全**：所有用户文本显式转义；颜色只接受 `#RRGGBB`；图片只接受 JPEG / PNG / WebP data URI；响应 CSP 禁止脚本、表单与外部资源，并强制附件下载。
26. **改密**：要求当前密码并拒绝同密码；事务内更新 scrypt 哈希与盐，删除当前账号除发起会话外的所有会话。这样当前浏览器不被踢出，旧密码与旧令牌不能继续使用。

---

## 6. 尚未实现（不要误认为已有）

- 版本历史界面：`GET/POST /api/chapters/[id]/revisions` 已存在，自动/手动快照与恢复接口可用，但编辑器没有版本列表、差异与恢复入口。这是 M1.5 第一项。
- 章节拖拽排序、跨卷移动。
- 全文查找替换、打字机模式、编辑器字体/行宽偏好真正生效（当前字体与字号已有基础记忆）。
- 全局搜索（FTS5）、回收站 UI、批注、邀请码、实时协作、AI 流式输出；成员与角色已交付，但只在本机。
- 故事设定的双向链接、时间线、伏笔视图与拖拽排序；基础 CRUD 已交付。
- 插画只能按段落锚定；没有图片替换（需删除重建）、跨章画廊、拖拽排序、行内环绕或任意坐标定位。带图分享已由网页 HTML 导出承担；EPUB / PDF 尚未实现。
- 书封对象存储与远程 URL；M1 只支持本地 data URL。
- PWA、自动备份、平台格式检查、写作统计页。
- 账号找回、忘记密码重置、账号删除、邮箱验证、第三方登录；已登录改密已交付，但没有找回入口。
- CSRF/Origin 校验、登录限流、HTTPS 与 secure cookie；当前只适合本机使用，禁止直接暴露公网。
- 跨设备协作、邀请码、实时多人编辑；当前成员只共享同一个本机数据库。
- 移动 Safari、真实手机、多人并发写 SQLite 的验证。

平台预览均为**界面模拟，非官方客户端**，不得宣称与官方一致。

---

## 7. M1.5 建议顺序

1. 版本历史界面：列表（时间、原因、字数）、只读预览、恢复前确认与自动快照。
2. 章节拖拽排序与跨卷移动；REAL sort 中点插入，精度不足时整卷重排。
3. 全文查找替换。
4. 打字机模式与段落聚焦。
5. 编辑器字体/行宽设置持久化并应用。
6. 预览目录定位当前章、阅读进度持久化。
7. 书架排序与加载骨架、错误边界。
8. 将 `.shots/verify*.mjs` 的核心场景固化为可重复运行的正式 E2E（建议 Playwright），不再依赖临时脚本。

M1.5 验收：连续写作 1 小时无保存焦虑；破坏性操作有确认或撤销；390 宽无溢出；以上场景有真实浏览器证据。

---

## 8. 恢复步骤

1. 读 `AGENTS.md` 与本文。
2. 看 `docs/04-roadmap.md` 的任务板与 `TaskList`。
3. 运行 `npm run dev`，打开书架与一篇正文，按当前页面实测，不凭记忆改代码。
4. 改完运行 `npm run typecheck`；里程碑收尾运行 `npm run build`。
5. UI 改动至少检查 1440 与 390 两档，并确认无横向溢出、无渐变、无 emoji。
6. 更新本文「当前现状」、路线图任务状态与相关接口/schema 文档。

---

## 9. 本地验收工具

`.shots/` 是临时目录，已在 `.gitignore` 中，不随项目分发：

- `cdp-shot.mjs`：启动无头 Chrome，用 CDP 设置真实设备宽度并截图。Windows 下 `--window-size=390` 会得到更宽的最小布局，**必须用 CDP 的 `Emulation.setDeviceMetricsOverride`** 才能得到有效 390 截图。
- `verify.mjs`：端到端验收（自动保存、离线、冲突、恢复、书架、创建作品、阅读器翻页/分页重排、导出）。运行前需开发服务器在 3000 端口；结束后清理临时作品/章节与长文夹具，并还原 `daily_stats` 和演示作品的 `updated_at`。
- `verify-management.mjs`：卷/章管理 API 验收，结束时硬清理临时作品。
- `verify-story.mjs`：书封与设定的接口层验收（存储、拒绝、清空、CRUD、归档拒绝），产品数据清理。
- `verify-options.mjs`：书封与设定的真实浏览器端到端验收；临时作品与设定在结束时硬删除。
- `verify-illustrations.mjs`：插画接口与端到端验收（上传、校验、锚点、图注、图片路由、预览分页、390 布局、删除与清理）；临时作品在结束时硬删除。
- 截图命名：`library-390.png`、`editor-768.png`、`preview-fanqie-1440.png`、`options-bible-detail-1440.png`、`illustration-preview-1440.png`、`mu-work-owner-1440.png` 等。
- `multiuser-visual.mjs`：多账号视觉验收；通过 API 登录两个临时账号，用 CDP 截取书架、作品、预览、登录页与 404 的 1440 / 390 视图，并报告 `scrollWidth` 与溢出元素。
- `verify-account-export.mjs`：网页导出与改密接口验收（所有者/读者导出、HTML 转义、CSP/响应头、改密生命周期），运行前清理同名临时作品，结束时恢复测试密码。
- `verify-web-visual.mjs`：网页导出、作品导出卡片、设置账号安全与注册页的 1440 / 390 浏览器验收；通过实际 DOM 检查图片加载、溢出与改密表单，并恢复密码。
- `verify-export-media.mjs`：直接打开已导出的 HTML，用 CDP 媒体模拟检查深色配色与打印规则，并确认无脚本、无外链。
- `multiuser.db`：为多账号验收准备的独立 SQLite 文件（含两个临时账号与导入作品），不进入版本库，也不参与默认演示库。若要在干净环境复验，删除该文件后重启即可。

这些脚本会直接读写数据库。运行前确认没有重要的未备份数据；不要在演示库上随意扩展测试数据。多账号脚本默认连接独立的 `.shots/multiuser.db`，不要让它指向真实作品库。

---

## 10. 协作与安全约束

- 未经用户明确要求，不执行 `git commit` / `git push`；每个 remote 单独授权。
- 若用户授权推送到 Gitee，提交作者与提交者邮箱使用 `hi@yxpil.com`。
- 不把 `AI_API_KEY`、数据库、`.env.local`、截图写入版本库。
- 不伪造功能或验收结果；未验证的项目必须标注。

---

## 11. 最近变更

### 2026-10-23 · 网页导出、账号安全与读者注册

- 新增 `src/lib/export-html.ts` 与导出路由 `format=html`：目录、正文、书封与插画合并为单个自包含 HTML，无脚本、无外部资源，支持深浅色与打印。
- 网页导出对所有用户文本显式转义，图片仅允许 data URI；响应带严格 CSP、`nosniff` 与附件下载头；所有者与只读读者均可导出。
- 作品页导出面板新增「网页 HTML」，副文案说明「单文件，含封面与插画」；JSON 仍承担无损备份。
- 新增 `POST /api/auth/password` 与 `changePassword`：校验当前密码、拒绝同密码，保留当前会话并删除其他会话。
- 设置页新增「账号安全」卡片；成功后清空输入并提示其他会话已退出。
- 登录/注册页、空书架与注册模式说明明确「作者与读者都可注册，读者由所有者按账号邀请」。
- 新增两份本地验收脚本；完成 1440 / 390 浏览器与 API 生命周期验收，临时数据清理、测试密码恢复。
- 文档同步至需求、设计系统、架构、数据模型、路线图与本文；无 schema 变更。

### 2026-10-23 · 本机多账号与整书迁移

- 新增账号与会话：`users.password_hash` / `password_salt`、`sessions`；注册、登录、登出、30 天 httpOnly 会话；迁移 `user_version` 至 4。
- 首个注册账号一次性接管 `local-user` 的演示作品、成员关系与统计；后续账号从空书架开始。
- `work_members` 正式启用：owner / editor / commenter / reader；所有读写接口按角色校验，无成员 404、角色不足 403。
- 新增登录/注册页与未登录跳转；设置页显示当前账号并可登出。
- 作品页新增成员卡片：所有者按账号邀请、调整角色、移除成员；作者 owner 不可改不可移除。
- 只读角色界面只保留预览与导出；章节链接改为 `/preview/...`，不进入编辑器。
- 新增整书 JSON 导出（书封、设定、卷章、插画）与书架导入；导入只新建归当前账号所有的作品，单事务、有上限。
- 新增中文品牌 404，避免非成员访问时显示默认英文错误页。
- 头像色块文字改用 `--on-cover`，修正深色模式下对比度隐患。
- 用两个临时账号完成 1440 / 390 浏览器验收与整书往返；`npm run typecheck` 与 `npm run build` 通过。

### 2026-10-23

- 新增自定义书封：数据库字段、data URL 校验、客户端 4:5 裁剪压缩、书架/作品页/表单展示、更换与移除。
- 新增故事设定库：五类实体、CRUD 接口、搜索与类型筛选、详情页；编辑器宽屏标签页与移动端抽屉。
- 修复移动端弹窗被抽屉 transform 裁切：`Modal` 改为 portal 到 `document.body`。
- 新增 `--on-cover` 与 `--cover-scrim` 令牌，消除新组件中的硬编码颜色。
- 迁移 `user_version` 至 2；补书封字段与 `story_entities` 表，已有数据保留。
- 完成 API 与浏览器端到端验收，类型检查与生产构建通过；临时数据已清理。

### 2026-10-23 · 章节插画增量

- 新增 `chapter_illustrations`：段落锚点、图注、BLOB 图片、宽高；迁移 `user_version` 至 3，已有数据保留。
- 新增插画 API：章节内新建、锚点/图注更新、硬删除、独立二进制图片路由与长期私有缓存。
- 新增客户端压缩：最长边 1400，WebP 质量递减，失败时 JPEG 白底；源文件上限 20 MB，服务端再次校验文件头与字节数。
- 编辑器新增插画管理区与顶栏「插画」快捷入口；默认锚定光标段落，桌面与移动端均可编辑、删除。
- 阅读器按段落插入插画与图注，限制图片高度并参与真实分页；图片加载后重新测量页数。
- 插画 CRUD 不进入自动保存协议，不改章节/作品时间、不加快照与每日字数；当时 TXT / Markdown 导出仍只含文字，后续网页与 JSON 导出包含插画。
- 完成接口与浏览器端到端验收，清理临时数据；`npm run typecheck` 通过。

### 2026-10-22

- 完成 M1 全部页面、接口、自动保存与五平台预览。
- 修复重复保存导致的崩溃恢复误报冲突（相同内容旧请求幂等成功）。
- 修复移动端大纲抽屉重复关闭按钮。
- 修复仅含已删章节的卷无法删除的问题（计数只算未删除章节）。
- 完成 1440 / 768 / 390 响应式截图检查与端到端验收。
- 新增 README、`.env.example`、Node 版本约束；完成本文与路线图状态同步。
