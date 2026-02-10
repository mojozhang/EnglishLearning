# English Learning Web App 🇺🇸

A comprehensive English learning web application built with **Next.js**, designed to guide users from reading to speaking with advanced speech correction features.

## 🌟 Core Features

### 1. 📁 PDF to Immersive Reading
- **Upload**: Drag & drop English PDF books.
- **Auto-Segmentation**: The system parses PDFs and intelligently splits them into manageable reading chunks (3 paragraphs per page).
- **Interactive Reading**: Click any word to add it to your vocabulary list instantly.

### 2. 🧠 Vocabulary Memorizing
- **Context-Aware**: Review words within the original sentence context.
- **Active Recall**: "Review Mode" requires user confirmation ("I Know This Word") to reinforce memory.

### 3. 🎙️ Advanced Speech Coach (The Killer Feature)
Optimized for non-native speakers, especially Chinese learners.

- **Engine choice**: Integrates **Baidu Speech API** to bypass Web Speech API limitations in China.
- **Smart Correction**:
    - **Visual Feedback**: Green for correct, Red for wrong pronunciation.
    - **Deep Optimization**: 
        - **Relaxed Matching**: Tuned Consonant Skeleton & Soundex algorithms to handle accent differences (e.g., *letter* vs *little*).
        - **Combined Speech**: Supports liaisons like "anapple" (an apple) or "gonna" (going to).
        - **Self-Correction**: Ignores stuttering (e.g., "re... re... really" is counted as correct).
        - **Name Recognition**: High tolerance for proper nouns (e.g., *Harry Potter*).
- **Interactive Replay**: 
    - Click **Green Words**: Plays standard pronunciation **once**.
    - Click **Red Words**: Plays standard pronunciation **3 times** for drilling.
    - **Silence Detection (VAD)**: Auto-stops recording after 4 seconds of silence.

## � User Guide

### Phase 1: Reading (Input)
1. **Upload PDF**: On the home page, select or drag your English book PDF.
2. **Read & Highlight**: The app displays text segment by segment.
    - **Left**: Original English text.
    - **Right**: Chinese translation (Simulated/Placeholder).
    - **Action**: Click any unfamiliar English word. It will turn **blue** and be added to your "Struggle List".
3. **Finish Section**: Once you finish reading a page and selecting words, click "Next" to proceed.

### Phase 2: Memorizing (Reinforcement)
1. **Review Words**: You will see flashcards for the words you selected.
2. **Check Context**: If you forget the meaning, click "Show Context" to see the original sentence where you found it.
3. **Confirm**: Click "I Know This Word" only when you have truly memorized it. This ensures active recall.

### Phase 3: Speaking (Output & Correction)
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

## �🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules
- **State Management**: Zustand
- **Audio Processing**:
    - **Recording**: MediaRecorder API (WAV format)
    - **Silence Detection**: Root Mean Square (RMS) analysis
    - **Recognition**: Baidu Cloud Speech API (Node.js Proxy)
- **Algorithms**: Levenshtein Distance, Soundex, Custom Phonetic Matching

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Baidu Cloud API Key (for speech recognition)

### Installation

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

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)
