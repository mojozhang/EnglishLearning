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

### � Recent Updates (V0.2)

- **Smart PDF Parsing (V9)**: Now features intelligent header/footer filtering, hyphenation repair (e.g., "morn- ing" -> "morning"), and auto-cleaning of "Spaced Caps" titles.
- **Parallel Translation**: Implemented concurrent paragraph translation to ensure perfect 1:1 English-Chinese alignment, solving previous text merging issues.
- **Auto-Translation Trigger**: Translation now starts automatically upon page load, no manual "Retry" needed.
- **Enhanced UI**: Speech Trainer now uses a high-contrast all-black text style for better readability, removing distracting background colors.
- **Security**: Added JWT secret enforcement in production, API payload size limits (DoS protection), and password strength validation.

### �📖 User Guide

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
- A Baidu Cloud API Key (for speech recognition)

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
   # Baidu Speech API Credentials
   BAIDU_APP_ID=your_app_id
   BAIDU_API_KEY=your_api_key
   BAIDU_SECRET_KEY=your_secret_key
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

### 🚀 最新更新 (V0.2)

- **智能 PDF 解析 (V9)**: 新增智能页眉/页脚过滤，连字符修复（如 "morn- ing" -> "morning"），以及“间隔大写”标题的自动清洗。
- **并行翻译**: 采用并发段落翻译技术，确保中英文段落 1:1 完美对齐，彻底解决之前的文本合并/错位问题。
- **自动翻译触发**: 页面加载后自动开始翻译，无需手动点击“重试”。
- **UI 体验升级**: 口语训练界面采用全黑高对比度文字风格，去除干扰背景色，专注阅读。
- **安全加固**: 生产环境强制检查 JWT 密钥，增加 API 包大小限制（防 DoS），并强化了密码强度校验。

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
- 百度云 API Key (用于语音识别)

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
   # 百度语音识别凭证
   BAIDU_APP_ID=your_app_id
   BAIDU_API_KEY=your_api_key
   BAIDU_SECRET_KEY=your_secret_key
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
