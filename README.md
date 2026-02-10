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

## 🛠️ Tech Stack

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
