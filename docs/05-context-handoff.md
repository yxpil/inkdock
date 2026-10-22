# 墨坞 Inkdock · 上下文交接

版本：1.1  
更新：2026-10-23  
适用状态：**M1 已完成；书封与故事设定增量已交付；M1.5 尚未开工**

本文是会话中断、上下文压缩或开发者更换后的恢复锚点。先读 `AGENTS.md`，再读本文，最后读 `docs/04-roadmap.md` 的任务板。

---

## 1. 一句话现状

单人写作工作台已经可用：书架、分卷分章、编辑器自动保存、本地草稿恢复、五平台阅读预览、真实分页翻页、TXT/Markdown 导出均已实现并在真实 Chrome 中验收。2026-10-23 追加自定义书封与五类故事设定，并可在编辑器内查看编辑。下一阶段是 M1.5 手感打磨，第一优先级是版本历史界面。

---

## 2. 已验证基线（2026-10-23）

验证环境：Windows、Node 24、Chrome 无头模式 + CDP 真机尺寸模拟；桌面 1440、平板 768、手机 390。验证脚本为 `.shots/verify.mjs`、`.shots/verify-management.mjs`、`.shots/verify-story.mjs`、`.shots/verify-options.mjs`（本地临时验收工具，`.shots/` 已 gitignore，不属于应用代码）。

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
| 移动端 | 设定抽屉 `scrollWidth = innerWidth = 390`，`panelWidth = 358`，`panelRight = 390` |
| 类型与构建 | 2026-10-23 复跑 `npm run typecheck`、`npm run build` 均通过 |

验收后数据库已清理临时数据，当前演示库：2 本作品、7 个未删除章节、0 条故事设定、0 张书封；`PRAGMA user_version = 2`。

**未验证**：配置真实 AI 密钥后的生成（本机无凭证）；移动 Safari 与真实手机；多进程并发写入；超大图片（>12 MB）在低内存手机上的处理表现。

---

## 3. 运行

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

- Node 必须 >= 24（使用内置 `node:sqlite`）。
- 数据库：`data/inkdock.db`，首次启动自动建表并写入两本示例作品。
- 可用 `INK_DB_PATH` 覆盖数据库路径。
- AI 为可选项：创建 `.env.local` 并设置 `AI_API_KEY`；`AI_BASE_URL` 默认 `https://api.openai.com/v1`，`AI_MODEL` 默认 `gpt-4o-mini`。修改后重启开发服务器。
- 端口冲突时用 `npx next dev -p 3001`，但验收脚本中的 `BASE` 需同步修改。

---

## 4. 代码地图

| 位置 | 职责 |
| --- | --- |
| `src/app/library/page.tsx` | 书架服务端取数 |
| `src/app/works/[workId]/page.tsx` | 作品资料与目录 |
| `src/app/write/[chapterId]/page.tsx` | 编辑器入口 |
| `src/app/preview/[workId]/page.tsx` | 手机预览入口 |
| `src/app/settings/page.tsx` | 设置页 |
| `src/app/api/**/route.ts` | 写接口；所有写操作走 `mutations.ts` |
| `src/app/api/works/[id]/story-entities/route.ts` | 设定列表与新建 |
| `src/app/api/story-entities/[id]/route.ts` | 设定更新与删除 |
| `src/lib/db.ts` | SQLite 连接、schema、迁移、种子 |
| `src/lib/queries.ts` | 服务端只读查询与聚合（含书封与设定） |
| `src/lib/mutations.ts` | 事务写入、归属校验、乐观锁、快照、书封与设定校验 |
| `src/lib/words.ts` | 字数口径（前后端共用） |
| `src/lib/platforms.ts` | 五平台排版参数、页眉页脚、品牌色 |
| `src/hooks/use-autosave.ts` | 自动保存状态机、草稿、退避重试 |
| `src/components/editor/editor-workspace.tsx` | 编辑器交互总装 |
| `src/components/editor/story-bible.tsx` | 设定列表、详情、搜索筛选与编辑弹窗 |
| `src/components/work/cover-image-picker.tsx` | 书封选择、4:5 裁剪与压缩 |
| `src/components/book-cover.tsx` | 图片/底色书封统一渲染 |
| `src/components/ui/modal.tsx` | portal 弹窗原语，焦点锁定与 Esc 关闭 |
| `src/components/reader/*` | 设备外壳、分页、平台皮肤、阅读设置 |
| `src/app/globals.css` | 语义设计令牌与基础样式 |
| `docs/01-design-system.md` | 胶囊设计系统与令牌说明 |
| `docs/02-architecture.md` | 分层、保存协议、分页与协作演进 |

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
11. **故事设定**存独立表 `story_entities`，按作品隔离，五类枚举，硬删除；不进入正文、预览或导出，也不改动作品 `updated_at`。
12. **编辑器设定面板**在 `xl` 及以上停靠在右栏，与 AI 面板共用分段标签；窄屏为右侧抽屉。桌面与移动共享提升后的列表状态。
13. **弹窗必须 portal**：移动抽屉使用 transform 动画，会形成 fixed 定位上下文；`Modal` 挂载到 `document.body` 才能全屏居中并正确遮罩。

---

## 6. 尚未实现（不要误认为已有）

- 版本历史界面：`GET/POST /api/chapters/[id]/revisions` 已存在，自动/手动快照与恢复接口可用，但编辑器没有版本列表、差异与恢复入口。这是 M1.5 第一项。
- 章节拖拽排序、跨卷移动。
- 全文查找替换、打字机模式、编辑器字体/行宽偏好真正生效（当前字体与字号已有基础记忆）。
- 全局搜索（FTS5）、回收站 UI、批注、成员与权限、实时协作、AI 流式输出。
- 故事设定的双向链接、时间线、伏笔视图与拖拽排序；基础 CRUD 已交付。
- 书封对象存储与远程 URL；M1 只支持本地 data URL。
- PWA、自动备份、平台格式检查、写作统计页。
- 真实账号与 CSRF 防护；当前只适合本机使用，禁止直接暴露公网。
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
- 截图命名：`library-390.png`、`editor-768.png`、`preview-fanqie-1440.png`、`options-bible-detail-1440.png` 等。

这些脚本会直接读写 `data/inkdock.db`。运行前确认没有重要的未备份数据；不要在演示库上随意扩展测试数据。

---

## 10. 协作与安全约束

- 未经用户明确要求，不执行 `git commit` / `git push`；每个 remote 单独授权。
- 若用户授权推送到 Gitee，提交作者与提交者邮箱使用 `hi@yxpil.com`。
- 不把 `AI_API_KEY`、数据库、`.env.local`、截图写入版本库。
- 不伪造功能或验收结果；未验证的项目必须标注。

---

## 11. 最近变更

### 2026-10-23

- 新增自定义书封：数据库字段、data URL 校验、客户端 4:5 裁剪压缩、书架/作品页/表单展示、更换与移除。
- 新增故事设定库：五类实体、CRUD 接口、搜索与类型筛选、详情页；编辑器宽屏标签页与移动端抽屉。
- 修复移动端弹窗被抽屉 transform 裁切：`Modal` 改为 portal 到 `document.body`。
- 新增 `--on-cover` 与 `--cover-scrim` 令牌，消除新组件中的硬编码颜色。
- 迁移 `user_version` 至 2；补书封字段与 `story_entities` 表，已有数据保留。
- 完成 API 与浏览器端到端验收，类型检查与生产构建通过；临时数据已清理。

### 2026-10-22

- 完成 M1 全部页面、接口、自动保存与五平台预览。
- 修复重复保存导致的崩溃恢复误报冲突（相同内容旧请求幂等成功）。
- 修复移动端大纲抽屉重复关闭按钮。
- 修复仅含已删章节的卷无法删除的问题（计数只算未删除章节）。
- 完成 1440 / 768 / 390 响应式截图检查与端到端验收。
- 新增 README、`.env.example`、Node 版本约束；完成本文与路线图状态同步。
