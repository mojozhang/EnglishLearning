# English Learning Web App 🇺🇸 | 英语学习助手

[English](#english) | [中文](#chinese)

---

<a name="english"></a>

## English

A comprehensive English learning web application built with **Next.js**, designed to guide users from reading to speaking with advanced speech correction features.

### 🌟 Core Features

#### 1. 📁 PDF to Immersive Reading

- **Upload**: Drag & drop English PDF books.
- **Auto-Segmentation**: The system parses PDFs and intelligently splits them into manageable reading chunks (3 paragraphs per page).
- **Interactive Reading**: Click any word to add it to your vocabulary list instantly.

#### 2. 🧠 Vocabulary Memorizing

- **Context-Aware**: Review words within the original sentence context.
- **Active Recall**: "Review Mode" requires user confirmation ("I Know This Word") to reinforce memory.

#### 3. 🎙️ Advanced Speech Coach (The Killer Feature)

Optimized for non-native speakers, especially Chinese learners.

- **Engine choice**: Integrates **SiliconFlow API** (siliconflow.cn) for high-quality speech recognition.
- **Smart Correction**:
  - **Visual Feedback**: Green for correct, Red for wrong pronunciation.
  - **Deep Optimization**:
    - **Relaxed Matching**: Tuned Consonant Skeleton & Soundex algorithms to handle accent differences (e.g., _letter_ vs _little_).
    - **Combined Speech**: Supports liaisons like "anapple" (an apple) or "gonna" (going to).
    - **Self-Correction**: Ignores stuttering (e.g., "re... re... really" is counted as correct).
    - **Name Recognition**: High tolerance for proper nouns (e.g., _Harry Potter_).
- **Interactive Replay**:
  - Click **Green Words**: Plays standard pronunciation **once**.
  - Click **Red Words**: Plays standard pronunciation **3 times** for drilling.
  - **Silence Detection (VAD)**: Auto-stops recording after 4 seconds of silence.

### 🚀 Recent Updates (V0.7.0)

- **🔥 Critical Bug Fixes (核心修复)**:
  - **Smart Abbreviation Handling**: Fixed an issue where abbreviations like "Mr." or "Mrs." caused incorrect sentence splitting.
  - **Number Mismatch Fix**: The speech trainer now intelligently maps words to digits (e.g., "eight" matches "8"), solving a major frustration.
  - **PDF Parsing V15**: Resolved text loss issues at page headers/footers and fixed split words like "ex perience" -> "experience".
- **💎 UX Polish (体验提升)**:
  - **Rock-Solid Control Bar**: The speech trainer's bottom control bar is now visually locked and flicker-free, regardless of content changes.
  - **Noise Cancellation (VAD)**: Tuned the voice activity detection threshold to ignore coughs and background noise—recording only starts when you speak.
  - **Progress Reset**: Fixed a bug where speech training progress persisted incorrectly when switching chapters.
- **☁️ Deployment**: Added comprehensive guides for deploying to Netlify and migrating to cloud PostgreSQL.

### 📜 Previous Updates (V0.3)

- **UI/UX Overhaul (Vibrant Edition)**: 
  - **Glassmorphism Design**: Applied a modern, frosted-glass aesthetic across all cards and containers.
  - **Interactive Visuals**: Added animated background gradients and lively micro-interactions.
  - **Premium Typography**: Integrated `Outfit` and `Plus Jakarta Sans` for a high-end reading experience.
- **Chrome Mobile Deep Optimization**:
  - **Responsive Layouts**: Headers and navigation elements now stack intelligently on small screens.
  - **Floating Controller**: A fixed bottom console for the Speech Trainer provides effortless thumb-reach control for recording and playback on mobile.
  - **Touch-Friendly Targets**: Optimized all buttons for high-precision touch interaction (`min-height: 44px+`).
- **Ultimate PDF Parser (V14)**:
  - **Suffix Healing**: Expertly repairs broken words (e.g., `ex pect` -> `expect`) common in PDF extraction.
  - **Semantic Stitching**: Hard-coded fixes for tricky character mapping issues like `rm` -> `firm` and `ght` -> `flight`.
  - **Brute-Force Cleanup**: Advanced PUA character filtering ensures zero garbage characters in the final text.
- **Parallel Translation (V2)**: Optimized concurrent paragraph translation for perfect 1:1 English-Chinese alignment.

### 📖 User Guide

#### Phase 1: Reading (Input)

1. **Upload PDF**: On the home page, select or drag your English book PDF.
2. **Read & Highlight**: The app displays text segment by segment.
   - **Left**: Original English text.
   - **Right**: Chinese translation (Simulated/Placeholder).
   - **Action**: Click any unfamiliar English word. It will turn **blue** and be added to your "Struggle List".
3. **Finish Section**: Once you finish reading a page and selecting words, click "Next" to proceed.

#### Phase 2: Memorizing (Reinforcement)

1. **Review Words**: You will see flashcards for the words you selected.
2. **Check Context**: If you forget the meaning, click "Show Context" to see the original sentence where you found it.
3. **Confirm**: Click "I Know This Word" only when you have truly memorized it. This ensures active recall.

#### Phase 3: Speaking (Output & Correction)

1. **Read Aloud**: The system shows one sentence at a time.
2. **Record**:
   - Click the **Microphone** button.
   - Wait for the "Ready... Go!" prompt.
   - Read the sentence clearly.
   - The recording auto-stops after 4 seconds of silence, or you can click Stop manually.
3. **Get Feedback**:
   - **Green**: Perfect pronunciation.
   - **Red**: Needs improvement.
4. **Correct & Repeat**:
   - **Click Green Word**: Hear standard pronunciation (1x).
   - **Click Red Word**: Hear standard pronunciation (3x loop) to practice.
   - **Play Original**: Hear the full sentence TTS.
   - **Play Recording**: Hear your own voice to compare.
5. **Next**: Only when you feel confident, move to the next sentence.

### 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules
- **State Management**: Zustand
- **Audio Processing**:
  - **Recording**: MediaRecorder API (WAV format)
  - **Silence Detection**: Root Mean Square (RMS) analysis
  - **Recognition**: Baidu Cloud Speech API (Node.js Proxy)
- **Algorithms**: Levenshtein Distance, Soundex, Custom Phonetic Matching

### 🚀 Getting Started

#### Prerequisites

- Node.js 18+
- A SiliconFlow API Key (for speech recognition)

#### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/mojozhang/EnglishLearning.git
   cd EnglishLearning
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env.local` file in the root directory:

   ```env
   # SiliconFlow Speech API Credentials
   SILICONFLOW_API_KEY=your_api_key
   ```

4. **Run Development Server**

   ```bash
   npm run dev
   ```

5. **Open Browser**
   Visit `http://localhost:3000` to start learning!

---

<a name="chinese"></a>

## 中文说明

一个基于 **Next.js** 构建的全栈英语学习应用，旨在通过先进的语音纠错功能，引导用户完成从“阅读输入”到“口语输出”的完整闭环。

### 🌟 核心功能

#### 1. 📁 PDF 沉浸式阅读

- **一键上传**: 支持拖拽上传英文原版 PDF 书籍。
- **智能分段**: 系统自动解析 PDF 并将其切分为易于阅读的短小段落（每页 3 段）。
- **交互式查词**: 点击文中任意单词，即可将其加入生词本。

#### 2. � 生词强化记忆

- **语境记忆**: 在原句的上下文中复习单词，而非死记硬背。
- **主动回忆**: "复习模式"要求用户确认 "我认识这个词" 才能通过，强化记忆效果。

#### 3. 🎙️ 智能语音教练 (杀手级功能)

专为非母语者（尤其是中国学习者）优化。

- **引擎选择**: 集成 **SiliconFlow API** (硅基流动)，提供更高质量的语音识别服务。
- **智能纠错**:
  - **视觉反馈**: 绿色代表发音正确，红色代表需要改进。
  - **深度优化**:
    - **宽容匹配**: 调整辅音骨架与 Soundex 算法，自动忽略口音差异（如 _letter_ vs _little_）。
    - **连读支持**: 支持像 "anapple" (an apple) 或 "gonna" (going to) 这样的连读。
    - **自我纠正**: 自动忽略口吃或重复尝试（例如 "re... re... really" 算作正确）。
    - **人名识别**: 对人名（如 _Harry Potter_）有极高的容错率。
- **交互式回放**:
  - **点击绿色单词**: 播放标准发音 **1 次**。
  - **点击红色单词**: 播放标准发音 **3 次** (循环洗脑)，帮助纠音。
  - **静音检测 (VAD)**: 4 秒无声自动停止录音。

### 🚀 最新更新 (V0.7.0)

- **🔥 核心修复 (Critical Fixes)**:
  - **智能缩写处理**: 修复了 "Mr.", "Mrs." 等缩写词导致句子被错误切断的问题。
  - **数字识别优化**: 语音教练现在支持数字与单词的智能互通（例如读 "eight" 能匹配原文的 "8"）。
  - **PDF 解析 V15**: 彻底解决了页眉页脚文本丢失问题，并自动修复了 "ex perience" 等单词断裂的 Bug。
- **💎 体验提升 (UX Polish)**:
  - **控制栏定海神针**: 口语训练底部的控制栏现在绝对固定，无论内容如何变化都纹丝不动，杜绝跳动。
  - **抗噪升级 (VAD)**: 调高了录音门槛，系统现在能自动忽略咳嗽声和背景噪音，只在您开口时触发。
  - **进度自动重置**: 修复了切换章节时，口语训练进度条没有归零的 Bug。
- **☁️ 部署准备**: 新增了 Netlify 部署指南与 PostgreSQL 数据库迁移文档。

### 📜 历史更新 (V0.3)

- **UI/UX 深度重绘 (全景活力版)**:
  - **玻璃拟态设计**: 全站应用现代磨砂玻璃质感，视觉层次更丰富。
  - **灵动动效**: 引入了动态流光背景与微交互，让学习不再枯燥。
  - **高端排版**: 集成 `Outfit` 与 `Plus Jakarta Sans` 字体，媲美纸质书的阅读体验。
- **Chrome 移动端深度适配**:
  - **响应式布局**: 导航栏与头像在手机端自动堆叠，完美适配小屏。
  - **浮动控制台**: 口语教练采用底部悬停中控台，单手即可轻松操作录音与放音。
  - **触控优化**: 所有按钮针对手机触控进行了面积优化 (`min-height: 44px+`)。
- **终极 PDF 解析算法 (V14)**:
  - **后缀修复 (Suffix Healing)**: 完美修复 PDF 常见的顽固断词（如 `ex pect` -> `expect`）。
  - **语义缝合**: 精准解决 `rm` 识别为 `firm`、`ght` 识别为 `flight` 等字符映射难题。
  - **暴力清洗**: 通过 PUA 字符过滤，彻底杜绝所有乱码。
- **并行翻译系统 (V2)**: 优化的并发段落翻译技术，确保中英段落 1:1 绝对对齐且加载飞速。

### 📖 使用指南

#### 第一阶段：阅读 (输入)

1. **上传 PDF**: 在主页选择或拖拽你的英文 PDF 书籍。
2. **阅读与高亮**:
   - **左侧**: 英文原文。
   - **右侧**: 中文翻译（模拟占位符）。
   - **操作**: 点击不认识的单词，它会变蓝并加入生词本。
3. **完成章节**: 读完一页并选完生词后，点击 "Next" 继续。

#### 第二阶段：背诵 (强化)

1. **复习单词**: 系统会展示你刚才选出的生词卡片。
2. **查看上下文**: 如果忘了意思，点击 "Show Context" 查看它在原句中的位置。
3. **确认**: 只有当你真的记住了，点击 "I Know This Word"。

#### 第三阶段：口语 (输出与纠正)

1. **朗读**: 系统一次展示一个句子。
2. **录音**:
   - 点击 **麦克风** 按钮。
   - 等待 "Ready... Go!" 提示。
   - 清晰地朗读句子。
   - 录音会在 4 秒静音后自动停止，或者你可以手动点击停止。
3. **获取反馈**:
   - **绿色**: 完美。
   - **红色**: 需要改进。
4. **纠错与跟读**:
   - **点绿色词**: 听标准发音 (1遍)。
   - **点红色词**: 听标准发音 (3遍循环)。
   - **播放原句**: 听整句 TTS。
   - **播放录音**: 听自己的录音进行对比。
5. **下一句**: 练好后，点击进入下一句。

### 🛠️ 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: CSS Modules
- **状态管理**: Zustand
- **音频处理**:
  - **录音**: MediaRecorder API (WAV 格式)
  - **静音检测**: RMS (均方根) 能量分析
  - **识别**: 百度云语音识别 API (Node.js 代理转发)
- **算法**: Levenshtein Distance (编辑距离), Soundex, 自定义音素匹配

### 🚀 快速开始

#### 前置要求

- Node.js 18+
- SiliconFlow API Key (用于语音识别)

#### 安装步骤

1. **克隆仓库**

   ```bash
   git clone https://github.com/mojozhang/EnglishLearning.git
   cd EnglishLearning
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **配置环境**
   在根目录创建 `.env.local` 文件：

   ```env
   # SiliconFlow 语音识别凭证
   SILICONFLOW_API_KEY=your_api_key
   ```

4. **运行开发服务器**

   ```bash
   npm run dev
   ```

5. **打开浏览器**
   访问 `http://localhost:3000` 开始学习！

## 🤝 贡献

欢迎提交 Pull Reqeust！如果是重大变更，请先提交 Issue 讨论。

## 📄 许可证

[MIT](https://choosealicense.com/licenses/mit/)
