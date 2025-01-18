# MiniMax AI Chat

A web-based chat application powered by MiniMax AI, featuring text chat, voice synthesis, voice cloning, and music generation capabilities.

## Features

- Real-time chat with AI
- Text-to-speech synthesis with customizable voice settings
- Voice cloning from audio samples
- Music generation with custom lyrics and reference tracks
- Streaming audio support
- Keyboard shortcuts for efficient interaction

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/playhousehosting/mini_max_ai.git
cd mini_max_ai
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your MiniMax API credentials:
```
MINIMAX_API_KEY=your_api_key_here
MINIMAX_GROUP_ID=your_group_id_here
PORT=3000
```

## Running the Application

Start the server:
```bash
node server.js
```

The application will be available at `http://localhost:3000`

## Usage

### Chat
- Type your message in the input field and click "Send" or press Enter
- Use Ctrl/Cmd + Enter to send messages
- Press Escape to clear the input field

### Voice Controls
- Select voice from the dropdown menu
- Adjust speed, volume, and pitch using sliders
- Toggle streaming audio with the checkbox
- Use Alt + V to toggle voice
- Use Alt + S to speak the last AI message

### Voice Cloning
1. Upload an audio file (MP3, WAV, or M4A)
2. Enter a unique voice ID
3. Enable/disable noise reduction
4. Add preview text (optional)
5. Click "Clone Voice"

### Music Generation
1. Upload reference music files
2. Enter lyrics
3. Select voice and instrumental references
4. Click "Generate Music"
5. Download the generated music

## API Documentation

Detailed API documentation is available in the application's interface, covering:
- Music Upload API
- Music Generation API
- Voice Cloning API
- Text-to-Speech API

## License

MIT License
