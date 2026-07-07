# ID Aura v2.8.0 增量架构设计文档

> **版本**：v2.8.0（基于 v2.7.8 增量）
> **架构师**：高见远（software-architect）
> **日期**：2026-07-07
> **状态**：评审通过 · 可实施

---

## 一、实现方案与框架选型

### 1.1 动画方案：纯 CSS Transition（不引入新库）

| 动画场景 | 实现方式 | 理由 |
|---------|---------|------|
| 面板展开/收起（SidePanel、AiPanel、SettingsModal） | `transform: translateX()` + `opacity` + `transition: 250ms ease-out` | 性能最优，不触发 reflow，GPU 加速 |
| 规范条目展开/折叠 | `max-height` + `opacity` + `overflow: hidden` + `transition: 200ms ease-out` | 无需额外库，CSS 原生支持 |
| 卡片 hover 动效 | `transform: translateY(-2px) scale(1.01)` + `box-shadow` + `transition: 200ms ease-out` | 简单高效 |
| AI 面板滑入 | `transform: translateX(100%) → translateX(0)` + `transition: 300ms cubic-bezier(0.2, 0.8, 0.4, 1.0)` | 侧滑面板标准做法 |
| 图片拖拽跟随 | `transform: translate3d()`（替代 `top/left`） | 60fps 保证，已在 Canvas 中部分使用 |

**结论**：不引入 `framer-motion` 或 `react-spring`。现有 CSS transition 能力完全覆盖 PRD 所有动画需求，引入动画库会增加 bundle size（~30KB gzip）且带来额外的 API 学习成本和运行时开销。

### 1.2 拖拽调整宽度方案：原生 Mouse Event

AI 面板宽度拖拽（P1-5）使用原生 `onMouseDown` + `window.mousemove/mouseup` 事件监听，通过 `requestAnimationFrame` 节流更新 `chatSlice.aiPanelWidth`。无需引入 `react-resizable` 等库。

### 1.3 核心原则

- **增量开发**：尽量复用现有代码，修改视觉层（CSS class + inline style），不动业务逻辑。
- **状态管理上移**：新增面板宽度、一级分类选中状态存入 Zustand store，不在组件内使用 `useState`。
- **事件上报**：Canvas 继续只负责渲染和事件上报，不处理数据计算。

---

## 二、文件列表及相对路径

### 2.1 新增文件

| 文件路径 | 作用 |
|---------|------|
| `src/components/AiPanel.jsx` | **独立 AI 面板**（从原 `AiChatPanel` 重构）。从屏幕右侧滑出的独立面板，宽度可调，包含完整 AI 对话功能。 |
| `src/components/FloatingAiButton.jsx` | **浮动 AI 按钮**。画布右下角 48px 圆角药丸按钮，hover 放大，点击打开 AI 面板。 |
| `src/components/ResizeHandle.jsx` | **拖拽条组件**。用于 AI 面板左侧边缘的宽度拖拽手柄，最小 320px，最大 600px。 |
| `src/components/PrimaryCategoryTabs.jsx` | **一级分类 Tab 组件**。SidePanel 顶部 3 个胶囊按钮（建筑/室内/景观），管理一级分类切换。 |
| `src/components/SpecSection.jsx` | **规范条目折叠组件**。封装 `max-height` + `opacity` 过渡动画的可折叠 section 容器。 |
| `src/components/SpecItemCard.jsx` | **规范条目卡片**。单个规范条目的展示卡片（用于品类详情列表），含 hover 效果和添加按钮。 |

### 2.2 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/data/specs.js` | 1. 现有 30 个品类：新增 `category` 字段（一级）并改名原 `category` 为 `subCategory`（二级）。<br>2. 新增 14 个品类（建筑 7 + 景观 7），含完整 sections/items。<br>3. 升级 `getCategoryList()` 返回结构。<br>4. 新增 `getPrimaryCategories()`、`getSpecsByPrimaryCategory()`、`getGroupedByPrimaryCategory()`。 |
| `src/store/chatSlice.js` | 新增 `aiPanelWidth: 400`、`setAiPanelWidth(width)` 状态与 action。 |
| `src/store/canvasSlice.js` | 修改 `focusAll()` 方法：计算可用视口宽度时减去 SidePanel 和 AiPanel 的当前宽度。 |
| `src/components/SidePanel.jsx` | 1. **移除**底部内嵌的 `<AiChatPanel />`。<br>2. 顶部新增 `<PrimaryCategoryTabs />`。<br>3. 品类列表按三级结构展示：一级分类 Tab → 二级分组 → 品类卡片。<br>4. 视觉升级：圆角卡片容器、呼吸间距、柔和阴影。<br>5. 搜索支持跨全库检索。 |
| `src/components/AiChatPanel.jsx` | **废弃**或降级为 `AiPanel` 的别名。建议将其内容完全迁移到 `AiPanel.jsx`，本文件保留一个 re-export 以兼容可能的 import，并在下一个版本中删除。 |
| `src/components/Toolbar.jsx` | 1. 从全宽条状改为居中圆角药丸卡片（`border-radius: 16px`）。<br>2. 新增「Sparkles」图标按钮（AI 面板入口）。<br>3. 去装饰化：移除 `glass-strong`/`iridescent-border-bottom`，改为柔和阴影卡片。<br>4. 分组竖线分隔。 |
| `src/components/Canvas.jsx` | 1. 画布边缘与工具栏/侧边栏增加 12px 呼吸间隙（调整 container padding）。<br>2. 网格点颜色从 `#2a2a2a` 改为 `#252528`。<br>3. 拖拽时优化为 `transform` 更新（已部分实现，需确认完整）。<br>4. 选中时的全局手柄样式适配。 |
| `src/components/CardNode.jsx` | 1. 所有卡片类型选中边框改为 2px 柔和蓝紫渐变（`#6b8cff → #a855f7`），使用 `border-image` 或伪元素实现。<br>2. hover 时统一增加 `translateY(-2px) scale(1.01)` + 阴影加深。<br>3. 调整手柄为圆角小点（`border-radius: 50%`），降低视觉突出度。<br>4. 移除过度光晕（`glow-accent` 改为柔和渐变边框）。 |
| `src/components/WelcomePage.jsx` | 去装饰化：移除 `glass-medium` 液态玻璃卡片，改为 `#1e1e24` 圆角柔和卡片；标题字重改为 500；按钮改为柔和渐变。 |
| `src/components/ZoomControls.jsx` | 从 `glass-light` 改为圆角小卡片，按钮 hover 改为 subtle 背景色变化。 |
| `src/components/SettingsModal.jsx` | 同步适配新风格：去装饰化、圆角卡片、柔和阴影。 |
| `src/components/CategoryCard.jsx` | 视觉升级：增加 hover 抬升和背景色变化，适配新间距体系。 |
| `src/styles/global.css` | 1. 新增柔和卡片设计 token（见第七节）。<br>2. 去装饰化：移除/弱化 Aura 光晕、虹彩边框、液态玻璃高光类（保留 class 定义供 P2 主题使用，但默认组件不再使用）。<br>3. 新增 `transition-normal` 和 `transition-slow` 的 cubic-bezier 精确值。 |
| `src/App.jsx` | 1. 布局调整：右侧支持 SidePanel 和 AiPanel 并排显示（两者之间有 12px 间距）。<br>2. 新增 `<AiPanel />` 和 `<FloatingAiButton />` 的条件渲染。<br>3. 主容器增加 `padding: 12px` 呼吸间隙。 |
| `package.json` | 无需新增依赖（确认）。 |

### 2.3 文件变更关系图

```
新增:
  AiPanel.jsx ←── 从 AiChatPanel.jsx 迁移 + 独立面板增强
  FloatingAiButton.jsx ←── 全新
  ResizeHandle.jsx ←── 全新
  PrimaryCategoryTabs.jsx ←── 全新
  SpecSection.jsx ←── 全新
  SpecItemCard.jsx ←── 全新

修改（强依赖）:
  specs.js ──→ SidePanel.jsx, AiPanel.jsx, Search
  chatSlice.js ──→ AiPanel.jsx, App.jsx
  canvasSlice.js ──→ App.jsx (focusAll)
  App.jsx ──→ 所有面板组件

修改（视觉层）:
  global.css ──→ 所有组件
  Toolbar.jsx, CardNode.jsx, Canvas.jsx, WelcomePage.jsx,
  ZoomControls.jsx, SettingsModal.jsx, CategoryCard.jsx,
  SidePanel.jsx
```

---

## 三、数据结构和接口（类图）

### 3.1 规范库数据结构（specs.js）

**变更前（v2.7.x）**：

```js
const specs = {
  "hotpot": {
    name: "火锅店",
    category: "餐饮工装",      // ← 仅二级，无法扩展
    icon: "🍲",
    description: "...",
    sections: [...]
  }
}
```

**变更后（v2.8.0）**：

```js
const specs = {
  // ── 室内设计规范（保留现有 30 个） ──
  "hotpot": {
    name: "火锅店",
    category: "室内设计规范",    // ← 一级：新增
    subCategory: "餐饮工装",      // ← 二级：原 category 改名
    icon: "🍲",
    description: "...",
    sections: [...]
  },
  // ... 其他 29 个品类同上处理

  // ── 建筑设计规范（新增 7 个） ──
  "office_building": {
    name: "办公建筑",
    category: "建筑设计规范",
    subCategory: "办公建筑",      // 当品类自身即为细分时，subCategory 等于 name
    icon: "🏢",
    description: "现代办公空间设计规范...",
    sections: [...]
  },
  // ... 其他 6 个建筑品类

  // ── 景观设计规范（新增 7 个） ──
  "park_landscape": {
    name: "公园景观",
    category: "景观设计规范",
    subCategory: "公园景观",
    icon: "🌳",
    description: "城市公园、社区公园...",
    sections: [...]
  },
  // ... 其他 6 个景观品类
}
```

**字段定义**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 品类名称 |
| `category` | string | **一级分类**：`建筑设计规范` / `室内设计规范` / `景观设计规范` |
| `subCategory` | string | **二级分类**：如 `餐饮工装`、`办公建筑` 等 |
| `icon` | string | Emoji 图标 |
| `description` | string | 品类描述 |
| `sections` | Array | 规范条目分组，内部结构不变 |

### 3.2 导出函数接口（specs.js）

```typescript
// 获取所有一级分类（用于顶部 Tab）
export function getPrimaryCategories(): string[]

// 按一级分类获取品类列表
export function getSpecsByPrimaryCategory(primary: string): Array<[string, Spec]>

// 按二级分类获取品类列表（保留兼容）
export function getSpecsBySubCategory(sub: string): Array<[string, Spec]>

// 获取所有品类的一级→二级分组结构（用于 SidePanel 渲染）
export function getGroupedByPrimaryCategory(): Record<string, Record<string, Array<{id, name, icon, description, itemCount}>>>

// 原有接口升级
export function getCategoryList(): Array<{id, name, icon, category, subCategory, description}>
export function getSpecByCategory(categoryId: string): Spec | null
export function searchSpecs(query: string): Array<SearchResult>
export function getAllSpecs(): Record<string, Spec>
```

### 3.3 Zustand Store 结构变更

**chatSlice.js**：

```typescript
// 新增状态
aiPanelWidth: number        // 默认 400，范围 [320, 600]

// 新增 action
setAiPanelWidth(width: number): void
```

**canvasSlice.js**（修改）：

```typescript
// focusAll 内部逻辑更新
// 计算可用视口宽度时需要减去侧边栏总宽度：
// const sidebarTotalWidth = (showSidePanel ? 300 : 0) + (isAiPanelOpen ? aiPanelWidth : 0) + gap
```

**兼容性说明**：

- 存量 `.moodboard` 文件中的 `specData` 和 `sectionTitle` 不包含 `category` 字段，不受结构变更影响，加载后正常显示。
- `customSpecs` 存储在 `projectSlice` 中，不依赖 `specs.js` 的一级分类，完全不受影响。
- 若其他代码直接读取 `specs[categoryId].category` 并期望旧值，需要同步更新。经搜索确认仅有 `SidePanel.jsx` 和 `AiChatPanel.jsx`（`AiPanel.jsx`）使用。

### 3.4 类图（简化）

```
┌─────────────────┐         ┌─────────────────┐
│    SpecItem     │         │   PrimaryCategory│
├─────────────────┤         ├─────────────────┤
│ label: string   │◄────────│ name: string    │
│ value: string   │  1..*   │ icon: string    │
│ note: string    │         │ key: string     │
│ priority: string│         └─────────────────┘
└─────────────────┘                ▲
                                 │ 1..*
┌─────────────────┐         ┌─────────────────┐
│     Section     │◄────────│   SpecCategory  │
├─────────────────┤  1..*   ├─────────────────┤
│ title: string   │         │ id: string      │
│ items: SpecItem[]│        │ name: string    │
└─────────────────┘         │ category: string│  ← 一级
                            │ subCategory: string│ ← 二级
                            │ icon: string    │
                            │ description: string
                            │ sections: Section[]
                            └─────────────────┘
```

---

## 四、程序调用流程（时序图）

### 4.1 AI 面板独立化：打开流程

```
用户                    Toolbar/FloatBtn         chatSlice          App.jsx              AiPanel
 │                           │                        │                 │                    │
 │ ──点击 Sparkles 按钮────► │                        │                 │                    │
 │                           │ ──────toggleAiPanel()──►│                 │                    │
 │                           │                        │ ──isAiPanelOpen:true─┘                │
 │                           │                        │                 │───渲染 AiPanel───►    │
 │                           │                        │                 │                    │───从右侧滑入
 │                           │                        │                 │                    │   (CSS translateX)
 │                           │                        │                 │◄───面板渲染完成──────│
 │                           │                        │                 │                    │
 │                           │                        │                 │                    │
```

### 4.2 AI 面板关闭流程

```
用户              AiPanel (顶部X/遮罩/再次点击入口)     chatSlice          App.jsx
 │                      │                              │                 │
 │ ──点击关闭──────────►│                              │                 │
 │                      │ ──────toggleAiPanel()──────►│                 │
 │                      │                              │ ──isAiPanelOpen:false─┘
 │                      │                              │                 │───卸载 AiPanel
 │                      │                              │                 │───Canvas 恢复全宽
 │◄─────────────────────│                              │                 │
```

### 4.3 规范库三级分类浏览流程

```
用户              SidePanel          PrimaryCategoryTabs      specs.js (getGroupedByPrimaryCategory)
 │                  │                      │                           │
 │ ──点击一级Tab──►│                      │                           │
 │                  │ ────onChange(primary)┘                           │
 │                  │                      │                           │
 │                  │◄────返回该一级下的二级分组及品类列表────────────────│
 │                  │                                                  │
 │◄───更新品类列表──│                                                  │
 │                  │                                                  │
 │ ──点击品类─────►│                                                  │
 │                  │ ──getSpecByCategory(id)─────────────────────────►│
 │                  │◄──返回 sections/items────────────────────────────│
 │◄──展开规范详情──│                                                  │
```

### 4.4 AI 面板与规范库联动（上下文注入）

```
AiPanel                chatSlice          aiClient.js               specs.js
 │                        │                    │                       │
 │ ──handleSend()────────►│                    │                       │
 │                        │ ──getCurrentSpecContext()                 │
 │                        │                    │                       │
 │                        │ ──读取当前选中品类或画布上的spec卡片───────►│
 │                        │◄──返回匹配的SpecData──────────────────────│
 │                        │                    │                       │
 │                        │ ──buildSpecContext(data, mode, template)──►│
 │                        │◄──返回system prompt───────────────────────│
 │                        │                    │                       │
 │                        │ ──sendStreamingChat()────────────────────►│
 │                        │                    │                       │
 │◄──流式更新UI───────────│                    │                       │
```

**关键说明**：
- `getCurrentSpecContext()` 逻辑保持不变，仍从 `cards` 中筛选 `type === 'spec'` 的卡片，匹配 `sectionTitle` 与品类名称。
- 新增的建筑和景观品类与室内品类一样，可被 AI 上下文注入，保持一致的 AI 能力。

---

## 五、任务列表（有序、含依赖关系）

### Phase 1 — 数据层与状态层（无 UI 依赖）

| # | 任务 | 依赖 | 负责人建议 | 说明 |
|---|------|------|-----------|------|
| T1 | **升级 `specs.js` 数据结构**：现有 30 个品类新增 `category` + `subCategory` 字段 | 无 | 后端/数据 | 保留原 `category` 值作为 `subCategory`，新增 `category: "室内设计规范"`。 |
| T2 | **新增 14 个品类数据**：建筑 7 + 景观 7，含完整 sections/items | T1 | 后端/数据 | 数据量大，可由 PM 提供初稿后工程师录入。 |
| T3 | **升级 `specs.js` 导出函数**：`getCategoryList()` 返回新结构；新增 `getPrimaryCategories()`、`getSpecsByPrimaryCategory()`、`getGroupedByPrimaryCategory()` | T1 | 全栈 | 确保 `searchSpecs()` 自动覆盖新增 14 个品类。 |
| T4 | **升级 `chatSlice.js`**：新增 `aiPanelWidth` 和 `setAiPanelWidth` | 无 | 前端 | 状态默认值 400，setter 做 clamp(320, 600)。 |
| T5 | **升级 `canvasSlice.js`**：修改 `focusAll()` 以考虑 AI 面板宽度 | T4 | 前端 | 计算视口时减去 `aiPanelWidth`（如果打开）。 |

### Phase 2 — 全局样式与基础组件（无业务依赖）

| # | 任务 | 依赖 | 说明 |
|---|------|------|------|
| T6 | **升级 `global.css`**：新增柔和卡片 token，去装饰化 | 无 | 新增 token 见第七节；保留旧 class 供后续 P2 主题使用，但默认不再引用。 |
| T7 | **升级 `Toolbar.jsx`**：圆角药丸卡片 + 新增 Sparkles AI 按钮 | T6 | 从全宽条状改为悬浮圆角卡片，移除 `glass-strong`/`iridescent-border-bottom`。 |
| T8 | **升级 `CardNode.jsx`**：新选中边框 + hover 动效 | T6 | 所有卡片类型（Spec/Image/Note/Drawing/Label）统一处理。 |
| T9 | **升级 `ZoomControls.jsx`**：圆角小卡片 + subtle hover | T6 | 移除 `glass-light`。 |
| T10 | **升级 `WelcomePage.jsx`**：去装饰化柔和卡片 | T6 | 移除 `glass-medium`、脉冲动画，改为柔和背景。 |
| T11 | **升级 `SettingsModal.jsx`**：适配新风格 | T6 | 同步去装饰化。 |
| T12 | **升级 `CategoryCard.jsx`**：hover 抬升 + 背景变化 | T6 | 小卡片风格统一。 |

### Phase 3 — 核心功能重构（依赖 Phase 1+2）

| # | 任务 | 依赖 | 说明 |
|---|------|------|------|
| T13 | **新建 `PrimaryCategoryTabs.jsx`** | T3, T6 | 一级分类胶囊 Tab，管理当前选中一级分类状态（可放在 SidePanel 内或用 local state）。 |
| T14 | **新建 `SpecSection.jsx` + `SpecItemCard.jsx`** | T6 | 封装可折叠 section 动画 + 单个条目卡片。 |
| T15 | **重构 `SidePanel.jsx`**：三级分类 + 移除 AI | T3, T6, T12, T13, T14 | 核心重构：移除 `<AiChatPanel />`，改为 `PrimaryCategoryTabs` → 二级分组 → 品类卡片 → 详情。 |
| T16 | **新建 `AiPanel.jsx`**：独立面板，从 `AiChatPanel` 迁移 | T4, T6 | 保留所有现有 AI 功能，改为独立滑出面板。 |
| T17 | **新建 `ResizeHandle.jsx`**：AI 面板宽度拖拽 | T4, T16 | 原生 mouse event 实现。 |
| T18 | **新建 `FloatingAiButton.jsx`**：画布右下角浮动按钮 | T6, T16 | 48px 圆角药丸，hover 放大。 |

### Phase 4 — 布局集成与优化（依赖 Phase 3）

| # | 任务 | 依赖 | 说明 |
|---|------|------|------|
| T19 | **重构 `App.jsx` 布局**：支持 SidePanel + AiPanel 并排 | T15, T16, T18 | 主容器增加 `padding: 12px`，右侧面板区支持两者同时显示（间距 12px）。 |
| T20 | **升级 `Canvas.jsx`**：边缘间距 + 网格颜色 + 拖拽优化 | T6, T19 | 画布背景色保持 `#1a1a1a`，网格点颜色改为 `#252528`，确认拖拽使用 `transform`。 |
| T21 | **废弃 `AiChatPanel.jsx` 或改为 re-export** | T16 | 保留文件但改为 `export { default } from './AiPanel'` 或直接删除所有 import 引用。 |

### Phase 5 — 测试与回归

| # | 任务 | 依赖 | 说明 |
|---|------|------|------|
| T22 | **更新单元测试**：`chatSlice.test.js`（新增 aiPanelWidth 测试）、`parseSpecItems.test.js`（如有影响） | T4, T16 | 确保 store 测试覆盖。 |
| T23 | **更新 `specs.js` 相关测试**：如有搜索/分类测试 | T3 | 确认新增品类可被搜索命中。 |
| T24 | **回归测试**：完整手动测试 211 个单元测试 + 核心功能验证 | T1-T21 | 重点验证：旧 `.moodboard` 文件兼容性、AI 面板独立开关、三级分类浏览、搜索跨库。 |

### 依赖关系图（简化）

```
Phase 1: T1 → T2 → T3
         T4 → T5

Phase 2: T6 → T7, T8, T9, T10, T11, T12

Phase 3: T3 + T6 → T13, T14
         T13 + T14 + T12 → T15
         T4 + T6 → T16 → T17
         T6 + T16 → T18

Phase 4: T15 + T16 + T18 → T19
         T6 + T19 → T20
         T16 → T21

Phase 5: T4 → T22
         T3 → T23
         T1-T21 → T24
```

---

## 六、依赖包列表

| 包名 | 版本 | 用途 | 是否必须 |
|------|------|------|---------|
| — | — | — | **无需新增任何 npm 包** |

**说明**：
- 所有动画需求（面板滑入、hover、折叠）使用纯 CSS `transition` + `transform` 实现。
- AI 面板宽度拖拽使用原生 `MouseEvent` + `requestAnimationFrame` 实现。
- 不需要 `framer-motion`、`react-spring`、`react-resizable`、`react-transition-group` 等库。

---

## 七、共享知识（跨文件约定）

### 7.1 新增 CSS Design Tokens

在 `global.css` 的 `:root` 中新增以下 token，所有组件统一使用：

```css
:root {
  /* ===== Soft Card Tokens (v2.8) ===== */
  --surface-card: #1e1e24;           /* 卡片面板背景 */
  --surface-card-hover: #23232a;      /* 卡片 hover 背景 */
  --surface-card-active: #2a2a35;   /* 用户消息/激活态背景 */

  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.2);      /* 基础卡片阴影 */
  --shadow-card-hover: 0 8px 32px rgba(0, 0, 0, 0.25); /* hover 加深阴影 */
  --shadow-panel: 0 8px 32px rgba(0, 0, 0, 0.25);      /* 侧边栏/面板阴影 */

  --radius-panel: 16px;   /* 大面板圆角（SidePanel、AiPanel） */
  --radius-card: 12px;    /* 卡片容器圆角 */
  --radius-pill: 9999px;  /* 胶囊按钮 */

  --border-gradient: linear-gradient(135deg, #6b8cff, #a855f7); /* 选中边框渐变 */

  --ease-out-smooth: cubic-bezier(0.2, 0.8, 0.4, 1.0);  /* 面板/卡片动画 */
  --ease-out-snap: cubic-bezier(0.16, 1, 0.3, 1);         /* 轻微弹性的关闭动画 */

  /* 间距（已有 token 基础上统一使用） */
  --gap-panel: 12px;      /* 面板与画布边缘间距 */
  --gap-card: 16px;       /* 卡片之间间距 */
  --padding-card: 16px;     /* 卡片内 padding */
}
```

### 7.2 去装饰化约定

| 旧风格类 | 新处理方式 | 说明 |
|---------|-----------|------|
| `glass-strong` / `glass-medium` / `glass-light` | 改为 `background: var(--surface-card)` + `box-shadow: var(--shadow-panel)` | 移除 backdrop-filter 液态玻璃效果 |
| `iridescent-border` / `iridescent-border-bottom` / `iridescent-border-left` | 移除或替换为 `border: 1px solid var(--border-default)` | 移除虹彩渐变边框 |
| `aura-blue` / `aura-purple` / `aura-cyan` | 保留 CSS 变量定义但默认 `body::before` 不再使用 | 移除背景 Aura 光晕 |
| `--glow-card-hover`（强发光） | 改为 `--shadow-card-hover`（柔和阴影） | 弱化 hover 光晕 |
| `--pulse-ring` | 移除 | 欢迎页 Logo 不再脉冲发光 |

### 7.3 选中边框渐变实现约定

由于 CSS `border-image` 不支持 `border-radius`，采用**伪元素方案**：

```css
.card-selected-border {
  position: relative;
}
.card-selected-border::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: calc(var(--radius-card) + 2px);
  padding: 2px;
  background: var(--border-gradient);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: -1;
}
```

**Inline Style 方案（供 JSX 使用）**：

```jsx
// CardNode 中选中时
border: '2px solid transparent',
background: 'linear-gradient(var(--surface-card), var(--surface-card)) padding-box, var(--border-gradient) border-box',
```

### 7.4 面板动画参数约定

所有面板/弹窗使用统一参数：

| 场景 | 时长 | easing | 属性 |
|------|------|--------|------|
| 面板滑入/滑出 | 250-300ms | `ease-out` / `cubic-bezier(0.2, 0.8, 0.4, 1.0)` | `transform`, `opacity` |
| 卡片 hover | 200ms | `ease-out` | `transform`, `box-shadow` |
| 规范条目展开/折叠 | 200ms | `ease-out` | `max-height`, `opacity` |
| 按钮/输入框 hover | 150ms | `ease-out` | `background`, `border-color`, `color` |

### 7.5 布局尺寸约定

| 元素 | 尺寸 | 说明 |
|------|------|------|
| SidePanel 宽度 | 300px | 保持不变 |
| AiPanel 默认宽度 | 400px | 范围 [320, 600] |
| 面板与画布间距 | 12px | 四边统一 |
| 两个右侧面板间距 | 12px | SidePanel 与 AiPanel 之间 |
| Toolbar 高度 | 48px | 保持不变，但改为悬浮圆角药丸 |
| Toolbar 左右距边 | 12px + 画布 padding | 不再贴顶 |

---

## 八、待明确事项（工程决策）

以下从 PRD 的「待确认问题」中提炼，给出明确的工程决策：

| PRD 问题 | 工程决策 | 理由 | 实现位置 |
|---------|---------|------|---------|
| **Q1**：AI 面板入口偏好 | **两者并存**：Toolbar 右侧新增 Sparkles 按钮（精准呼出），画布右下角增加浮动药丸按钮（快捷访问）。 | 满足不同场景：Toolbar 适合有目的的操作，浮动按钮适合随时唤起。 | `Toolbar.jsx` + `FloatingAiButton.jsx` |
| **Q3**：SidePanel + AiPanel 同时打开时总宽度达 700px+ | **默认行为**：同时打开时，Canvas 自动压缩（保持当前缩放比例，不强制 focusAll）。`focusAll()` 在需要时（如用户点击百分比按钮）会正确计算可用视口。不强制「只开一个」的快捷切换，但支持用户手动关闭任一面板。 | 给用户自由，不强制约束。自动压缩已在 `canvasSlice.focusAll()` 中处理。 | `canvasSlice.js` + `App.jsx` |
| **Q4**：旧液态玻璃风格是否保留 | **v2.8.0 完全切换到新风格**，旧的 `glass-*` / `iridescent-*` CSS class 保留在 `global.css` 中但默认组件不再引用，作为 P2「双主题切换」的技术储备。 | 减少 v2.8 工作量，不引入主题切换的复杂性。 | `global.css` + 所有组件 |
| **Q5**：建筑和景观品类是否支持 AI 上下文注入 | **全部支持**。新增 14 个品类的数据结构（`sections/items`）与室内完全一致，`buildSpecContext()` 无需修改即可工作。 | 保持 AI 能力的一致性。 | `AiPanel.jsx` + `aiClient.js` |
| **Q6**：AI 上下文 token 量是否会因品类扩大而超限 | **建议实现**：在 `buildSpecContext()` 中，当所有 sections/items 的字符数超过阈值（约 4000 token）时，按 `priority: 'high'` 优先注入，中低优先级条目做摘要或省略。建筑和景观品类保持与室内同等的 sections/items 密度。 | 保证 AI 性能，不降低数据质量。token 超限在 44 个品类中大概率不会出现（单次注入仅一个品类），但防御性实现。 | `utils/aiClient.js` |
| **Q2**：新增 14 个品类数据由谁编写 | **非工程决策**：建议由 PM 输出初稿，由建筑/景观设计师审核后，工程师录入 `specs.js`。数据格式与现有室内品类完全一致，无技术风险。 | — | `src/data/specs.js` |

---

## 九、风险与回滚策略

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| specs.js 数据量从 30→44，文件体积增大 | 初始加载时间轻微增加 | `specs.js` 为静态 JSON，Vite 构建时会自动 tree-shake 未引用的导出；懒加载方案（`import()`）在 P2 中考虑。 |
| 旧 `.moodboard` 文件兼容性 | 高 | 严格遵循「specData 中不含 category」的兼容性结论。T24 回归测试中必须覆盖旧文件加载。 |
| SidePanel 移除 AiChatPanel 后，用户习惯改变 | 中 | 浮动按钮提供足够明显的快捷入口；Toolbar Sparkles 按钮提供精准入口。 |
| CSS 去装饰化导致部分用户不适应 | 低 | P2 可考虑保留经典主题切换，v2.8 先收集反馈。 |
| `focusAll` 计算视口时漏算面板宽度 | 中 | T5 中明确修改 `focusAll`，T24 回归测试中验证「SidePanel+AiPanel 同时打开时 focusAll 行为正确」。 |

---

## 十、附录：快速参考

### 新增文件清单（6 个）

```
src/components/AiPanel.jsx
src/components/FloatingAiButton.jsx
src/components/ResizeHandle.jsx
src/components/PrimaryCategoryTabs.jsx
src/components/SpecSection.jsx
src/components/SpecItemCard.jsx
```

### 修改文件清单（16 个）

```
src/data/specs.js
src/store/chatSlice.js
src/store/canvasSlice.js
src/components/SidePanel.jsx
src/components/AiChatPanel.jsx    ← 废弃/迁移
src/components/Toolbar.jsx
src/components/Canvas.jsx
src/components/CardNode.jsx
src/components/WelcomePage.jsx
src/components/ZoomControls.jsx
src/components/SettingsModal.jsx
src/components/CategoryCard.jsx
src/styles/global.css
src/App.jsx
package.json                          ← 无需修改（确认无新依赖）
```

### 无需修改的文件（核心业务逻辑不变）

```
src/store/useStore.js
src/store/cardSlice.js
src/store/selectionSlice.js
src/store/historySlice.js
src/store/projectSlice.js
src/store/settingsSlice.js
src/utils/aiClient.js
src/utils/fileIO.js
src/utils/parseSpecItems.js
src/utils/geometry.js
src/utils/exportImage.js
electron/main.js
electron/preload.js
```

---

> **文档版本**: v1.0 | 编制: software-architect | 日期: 2026-07-07
