# AGENTS.md · 墨坞 Inkdock

本文件是任何后续开发者或 AI 代理进入本项目的第一入口。先读本文件，再读 `docs/`。当上下文被压缩或会话更换时，以本文件与 `docs/05-context-handoff.md` 为准。

---

## 1. 项目是什么

**墨坞 Inkdock**：本地优先的小说创作与协作工作台。中文界面，纯文本正文，分书、分卷、分章，自动保存，内置安卓手机预览与五个主流阅读平台排版模拟（含真实分页翻页）。书封与故事设定已可在写作现场编辑查看。长期目标是加入角色权限、批注、实时协作与 AI 增强。

当前状态：**M1 已完成（2026-10-22）**；**书封与故事设定增量已交付（2026-10-23）**。下一里程碑是 **M1.5**（手感打磨），尚未开工。范围与验收见 [docs/04-roadmap.md](docs/04-roadmap.md)。

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
13. 故事设定按作品隔离，可硬删除；设定只用于写作参考，不得写入正文、手机预览或导出文件。
14. 书封底色与设定识别色属于用户数据，集中在 `src/lib/constants.ts`；覆盖其上的文字必须使用 `--on-cover` 令牌。

## 3. 技术与命令

- Next.js 16 App Router、React 19、TypeScript strict、Tailwind CSS 4、lucide-react。
- Node 24+（使用内置 `node:sqlite`）。
- 数据库：`data/inkdock.db`（自动创建，已 gitignore）。
- 开发：`npm run dev`（http://localhost:3000）
- 类型：`npm run typecheck`
- 构建：`npm run build`
- 环境变量（可选，AI）：`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`。

## 4. 目录与数据边界

- `src/app/**/page.tsx`：服务端取数（`lib/queries.ts`），设置 `export const dynamic = "force-dynamic"`。
- `src/app/api/**/route.ts`：写操作（`lib/mutations.ts`），校验输入、归属、冲突。
- `src/components/**`：客户端交互组件。不得导入 `lib/db.ts` 或 `node:*`。
- `src/lib/platforms.ts`：五个平台的设计参数与默认排版。
- `src/hooks/use-autosave.ts`：自动保存状态机。修改前先读 [架构文档第 5 节](docs/02-architecture.md)。
- 设计令牌：`src/app/globals.css`。新增颜色先加令牌，再使用。
- `src/components/editor/story-bible.tsx`：故事设定面板与编辑弹窗；桌面停靠、移动端抽屉共用同一状态。
- `src/components/work/cover-image-picker.tsx`：书封选择、4:5 居中裁剪与压缩。
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
3. 把 `.shots/verify*.mjs` 的核心场景固化为正式 E2E。
4. 有可用密钥时补验 AI 真实生成；无密钥时保持「未配置」诚实降级。

## 8. 上下文压缩后的恢复步骤

1. 读本文件。
2. 读 `docs/05-context-handoff.md`。
3. 读 `docs/04-roadmap.md` 的「当前待办」。
4. 查看 `TaskList` 中未完成任务。
5. 直接运行 `npm run dev`，按当前页面实测，不凭记忆修改。
