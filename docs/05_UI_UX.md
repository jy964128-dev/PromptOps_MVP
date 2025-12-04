这是一个为您转换好的标准 Markdown 格式文档。

---

# UI/UX 线框图与交互描述 (For Designer)

**设计目标：** 打造 "Clean, Distraction-Free, Engineering-Grade"（干净、无干扰、工程级）的界面。参考风格：Vercel, Linear, Shadcn/ui。

# 1. 总体布局 (The Layout)

采用标准的 **三栏式布局 (Three-Column Layout)**，高度占满屏幕 (100vh)。

* **Left Sidebar (导航栏)**: 宽度固定 260px，深色或浅灰色背景。
* **Center Stage (编辑器)**: 弹性宽度 (Flex-1)，白色背景，核心工作区。
* **Right Sidebar (调试区)**: 宽度固定 380px (较宽，为了容纳对话和变量设置)，带边框分隔。

# 2. 详细区域设计

## A. 左侧导航栏 (Sidebar)

* **Header**: 产品 Logo (PromptOps) + 组织切换下拉框。
* **Navigation**:
    * Dashboard (仪表盘)
    * Library (Prompt 列表 - Active)
    * Settings (设置 - API Key 管理在此处)
* **Project List**: 文件夹树状结构。
* **Footer**: 用户头像 + "Upgrade Plan" 按钮。

## B. 中间编辑器 (Center Stage) - 核心

### Top Bar (面包屑与操作)
* **左侧**：面包屑 `Projects / HR Bots / Resume Parser`。
* **右侧**：
    * **Save 按钮**: (状态：Saved / Unsaved)。
    * **Deploy 按钮**: (Phase 2 功能，现在置灰或作为 Pre-release)。
    * **Mode Switcher (Segmented Control)**: `[ Builder ]` | `[ Code ]`。

### Content Area (Builder Mode 状态)
这是一个垂直滚动的区域，由一系列 "Block Cards" (卡片) 组成。

* **Card 1: Core Identity**
    * **Role 输入框**: (Label: 角色)。
    * **Task 多行文本框**: (Label: 核心任务)。
* **Card 2: Context & Variables**
    * **Context 大文本框**。
    * **交互**: 当用户输入 `{{` 时，触发高亮或下拉提示。
* **Card 3: Constraints**
    * **Tags Input 组件**：用户输入 "No Jargon" 按回车变成一个 Tag 胶囊。
* **Card 4: Few-Shot Examples**
    * **表头**：User Input | AI Output。
    * **列表**：每一行是一对 Textarea。
    * **底部**：`+ Add Example` 按钮。

### Content Area (Code Mode 状态)
* 全屏 Monaco Editor (类似 VS Code)。
* 深色代码背景，支持 Jinja2 高亮。

## C. 右侧调试区 (Right Sidebar - The Playground)

### Top Section: Configuration
* **Model Selector**: 下拉框 (图标 + GPT-4o / Claude 3.5 Sonnet)。
* **Parameters**: 折叠面板 (Temperature 滑块, Max Tokens 输入框)。

### Middle Section: Variables (动态区域)
* **标题**: "Test Variables"。
* **内容**: 自动生成的表单。
* 如果编辑器里有 `{{name}}`，这里显示 Label name + Input 框。
* **空状态**: "No variables detected."

### Bottom Section: Chat Preview
* **标题**: "Preview & Run"。
* **Chat Window**: 气泡式对话流。
* **Run Button**: 底部悬浮大按钮 (Primary Color)。
* **Button Text**: "Run" 或 "Run (⌘+Enter)"。
* **Right Accessory**: Cost Radar (e.g., "Est: $0.002").