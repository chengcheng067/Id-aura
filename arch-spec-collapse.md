# ID Aura 规范数据结构分析与 SidePanel 折叠实现方案

---

## 1. 规范数据文件路径与结构

**文件路径**: `src/data/specs.js`

### 顶层结构

```javascript
const specs = {
  "hotpot": {
    name: "火锅店",
    category: "餐饮",           // ← 一级分类标识（要改的字段）
    icon: "🍲",
    description: "火锅店设计需重点考虑排烟通风、电磁炉供电、食材动线",
    sections: [ ... ]
  },
  // ... 更多品类
}
```

### 导出 API（文件末尾）

| 函数 | 返回值 | 用途 |
|------|--------|------|
| `getCategoryList()` | `[{id, name, icon, category, description}]` | 获取所有品类的扁平列表 |
| `getSpecByCategory(id)` | 单个完整 spec 对象 或 `null` | 根据品类 ID 查询详情 |
| `getAllSpecs()` | 整个 `specs` 对象 | 获取完整数据（备用） |
| `searchSpecs(query)` | `[{categoryId, categoryName, categoryIcon, sectionTitle, ...item}]` | 搜索所有规范项 |

### 单条规范项数据结构（`sections[].items[]` 中的元素）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `label` | string | 规范名称 | `"主通道宽度"` |
| `value` | string | 标准值 | `"≥ 1200mm"` |
| `note` | string | 备注说明 | `"消防疏散要求，至少1.2米"` |
| `priority` | `"high"\|"medium"\|"low"` | 优先级 | `"high"` |

---

## 2. 分类层级关系（一级 → 二级）

当前所有一级分类取自知 `category` 字段去重得到。SidePanel 中通过以下代码聚合：

```javascript
// SidePanel.jsx 第7-12行
const allCategories = getCategoryList()
const groupedCategories = allCategories.reduce((acc, cat) => {
  if (!acc[cat.category]) acc[cat.category] = []
  acc[cat.category].push(cat)
  return acc
}, {})

// categoryGroups = Object.keys(groupedCategories)
// → ["餐饮", "酒店民宿", "家装"]    （当前三个一级分类）
```

### 当前完整层级表

```
餐饮 ─┬─ 火锅店 (hotpot)
     ├─ 日料店 (japanese)
     ├─ 烧烤店 (bbq)
     ├─ 咖啡厅/茶饮 (cafe)
     ├─ 中餐厅（正餐）(chinese-restaurant)
     ├─ 快餐/简餐 (fast-food)
     ├─ 酒吧/清吧 (bar-lounge)
     ├─ 烘焙/面包店 (bakery)
     ├─ 甜品店 (dessert)
     ├─ 茶馆/茶楼 (teahouse)
     ├─ 自助餐厅 (buffet)
     ├─ 西餐厅 (western-restaurant)
     └─ 东南亚餐厅 (southeast-asian)

酒店民宿 ─┬─ 酒店客房 (hotel-guestroom)
         ├─ 酒店公共区域 (hotel-public)
         ├─ 民宿/精品客栈 (minsu)
         ├─ 精品酒店 (boutique-hotel)
         ├─ 度假酒店 (resort)
         ├─ 青年旅舍 (hostel)
         └─ 公寓式酒店 (serviced-apartment)

家装 ─┬─ 客厅 (living-room)
     ├─ 卧室 (bedroom)
     ├─ 厨房（家装）(kitchen-home)
     ├─ 卫生间 (bathroom)
     ├─ 餐厅 (dining-room)
     ├─ 书房/家庭办公室 (study)
     ├─ 儿童房 (kids-room)
     ├─ 玄关/门厅 (entryway)
     ├─ 阳台 (balcony)
     └─ 衣帽间 (walkin-closet)
```

**注意**: `bar-lounge`, `bakery`, `dessert`, `teahouse`, `buffet`, `western-restaurant`, `southeast-asian` 这几个品类在代码中有注释 `新增品类`，它们同样属于一级分类"餐饮"。

---

## 3. SidePanel 渲染分类菜单的核心代码

### 渲染入口（SidePanel.jsx 第 192-238 行）

```jsx
{categoryGroups.map((group) => (
  <button
    key={group}
    onClick={() => {
      const firstCat = groupedCategories[group]?.[0]
      if (firstCat) {
        setSelectedCategory(firstCat.id)
        setSearchQuery('')
      }
    }}
    style={{
      padding: '6px 14px',
      borderRadius: 'var(--radius-full)',  // 胶囊形状
      border: '1px solid var(--border-default)',
      background: 'transparent',
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: 'var(--text-xs)',
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}
  >
    {group}
  </button>
))}
```

### 品类卡片列表（SidePanel.jsx 第 256-287 行）

```jsx
{Object.entries(groupedCategories).map(([group, cats]) => (
  <div key={group} style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', padding: '6px 0 4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {group}
    </div>
    {cats.map((cat) => (
      <CategoryCard
        key={cat.id}
        id={cat.id}
        name={cat.name}
        icon={cat.icon}
        itemCount={(getSpecByCategory(cat.id)?.sections || []).reduce((sum, s) => sum + s.items.length, 0)}
        isSelected={false}
        onClick={() => { setSelectedCategory(cat.id); setSearchQuery('') }}
      />
    ))}
  </div>
))}
```

---

## 4. 新增 "书店" 品类需遵循的数据格式

在 `src/data/specs.js` 文件中，在适当位置（建议放在 `southeast-asian` 之后、`hotel-guestroom` 之前，或末尾 `walkin-closet` 之后）新增一个条目。

### 完整格式模板

```javascript
"bookstore": {
    name: "书店",
    category: "餐饮工装",        // ← 注意：先改后，category 为 "餐饮工装"
    icon: "📚",                  // 选择一个合适的 emoji
    description: "你的描述文字",   // 一句话概述
    sections: [
      {
        title: "动线与通道",
        items: [
          { label: "主通道宽度", value: "≥ 900mm", note: "书架间基本通行", priority: "high" },
          // ... 更多条目
        ]
      },
      // ... 更多 section
    ]
  },
```

### 各字段说明

| 字段路径 | 类型 | 必填 | 说明 |
|---------|------|------|------|
| `bookstore` | string (key) | ✅ | 品类 ID，全小写英文 + 短横线 |
| `.name` | string | ✅ | 显示名称，如 `"书店"` |
| `.category` | string | ✅ | **一级分类名**，改为 `"餐饮工装"` |
| `.icon` | string | ✅ | 单个 emoji 字符 |
| `.description` | string | ✅ | 一句话简介（可选） |
| `.sections` | array | ✅ | 规范分组，至少 1 个 |
| `.sections[].title` | string | ✅ | 分组标题，如 `"动线与通道"` |
| `.sections[].items` | array | ✅ | 规范条目列表，至少 1 个 |
| `.sections[].items[].label` | string | ✅ | 规范名称 |
| `.sections[].items[].value` | string | ✅ | 标准值/尺寸 |
| `.sections[].items[].note` | string | 可选 | 备注说明 |
| `.sections[].items[].priority` | string | ✅ | 优先级，只能是 `"high"`/`"medium"`/`"low"` |

---

## 5. 一级分类折叠的技术建议

### 当前问题

目前一级分类（"餐饮"、"酒店民宿"、"家装"）以**药丸形 pill tabs** 形式展示在搜索框下方，点击后跳转到该分类下第一个品类的详情页。用户无法看到当前一级分类下有哪些子品类卡片。

### 折叠方案设计

**思路：将 pill tabs 改为可折叠的面板标题行**

#### 方案：分组列表头部可折叠（推荐）

将当前渲染逻辑改为：

```
餐饮工装  ▶  (点击可折叠/展开，默认展开)
  ├─ 火锅店 (CategoryCard)
  ├─ 日料店 (CategoryCard)
  ├─ 书店 (CategoryCard)   ← 新增
  └─ ...

酒店民宿  ▶  (点击可折叠/展开，默认折叠)
  ├─ 酒店客房
  └─ ...

家装  ▶  (默认折叠)
  ├─ 客厅
  └─ ...
```

#### 具体修改

**1. 状态管理方式**

使用 React 的 `useState`（直接在 SidePanel 中管理），用对象记录每个一级分类的折叠状态：

```javascript
// SidePanel.jsx 已有相关 state（第29行）：
// 但 current expandedSections 是用来控制 sections 折叠的
// 需要新增一个 state 来控制一级分类的折叠

const [collapsedGroups, setCollapsedGroups] = useState({
  "餐饮工装": false,    // false = 展开（默认展开第一个）
  "酒店民宿": true,     // true = 折叠
  "家装": true
})
```

或者更通用的写法（通过索引）：

```javascript
const [collapsedGroups, setCollapsedGroups] = useState({})
const [defaultExpanded, setDefaultExpanded] = useState(true)  // 标记是否已初始化默认展开
```

**2. 渲染逻辑修改**

将当前 "pill tabs" 和 "category list" 两段渲染合并为**可折叠分组列表**：

```jsx
{Object.entries(groupedCategories).map(([group, cats], idx) => {
  // 默认展开第一个（首次渲染时设置）
  const isCollapsed = collapsedGroups[group] ?? (idx === 0 ? false : true);

  return (
    <div key={group} style={{ marginBottom: 12 }}>
      {/* 可点击的组标题 */}
      <div
        onClick={() => setCollapsedGroups(prev => ({
          ...prev,
          [group]: !(prev[group] ?? (idx === 0 ? false : true))
        }))}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-primary)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          borderBottom: '1px solid var(--border-default)',
          userSelect: 'none',
        }}
      >
        <span>{group}</span>
        <span style={{
          transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          transition: 'transform 150ms ease-out',
          display: 'inline-block',
          fontSize: 10,
          color: 'var(--text-tertiary)',
        }}>
          ▶
        </span>
      </div>

      {/* 品类卡片列表（折叠时隐藏） */}
      {!isCollapsed && cats.map(cat => (
        <CategoryCard key={cat.id} ... />
      ))}
    </div>
  )
})}
```

**3. 同时移除**

- 移除当前 pill tabs 区域（第 193-238 行的独立 button 渲染）
- 原有 `categoryGroups` 逻辑仍保留作为数据结构使用，但不再作为 pill button 渲染

**4. 注意事项**

- **默认展开第一个**: 用 `??` 运算符（nullish coalescing）确保首次渲染时 `idx === 0` 的组为展开状态
- **状态持久化**: `collapsedGroups` 只是 UI 状态，无需写入 store，组件内 useState 即可
- **搜索状态下不显示折叠列表**: 当前逻辑是搜索时显示搜索结果（`searchQuery` 非空时），折叠列表在非搜索状态显示，所以不影响搜索功能

### 影响范围

| 文件 | 修改类型 |
|------|----------|
| `src/data/specs.js` | ✅ 新增数据（书店）+ 修改字段（餐饮→餐饮工装） |
| `src/components/SidePanel.jsx` | ✅ 修改渲染逻辑，新增折叠 state |
| 其他文件 | ❌ 无需修改 |

---

## 6. 需求实施步骤（汇总）

### 步骤一：改名前

1. **搜索所有 `category: "餐饮"` 的条目**，将其改为 `category: "餐饮工装"`
   - 影响品类：hotpot, japanese, bbq, cafe, chinese-restaurant, fast-food, bar-lounge, bakery, dessert, teahouse, buffet, western-restaurant, southeast-asian（共 13 个）

### 步骤二：新增 "书店"

2. **在 `src/data/specs.js` 中新增 `"bookstore"` 条目**
   - `category` 字段设为 `"餐饮工装"`
   - 建议按行业特点设计 sections（如：动线与通道、书架与陈列、阅读区、收银区、功能区配比等）

### 步骤三：实现折叠

3. **修改 `src/components/SidePanel.jsx`**
   - 替换 pill tabs 渲染为可折叠的组标题行
   - 新增 `collapsedGroups` state 管理折叠状态
   - 默认展开第一个分组（"餐饮工装"），其余折叠
