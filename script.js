document.addEventListener('DOMContentLoaded', () => {
    const chatLog = document.getElementById('chat-messages');
    const userInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-message');
    const speakButton = document.getElementById('speak-button');
    const voiceSelect = document.getElementById('voice-select');
    const speedControl = document.getElementById('speed-control');
    const volumeControl = document.getElementById('volume-control');
    const pitchControl = document.getElementById('pitch-control');
    const streamToggle = document.getElementById('stream-toggle');
    const languageBoost = document.getElementById('language-boost');

    const CHAT_API_URL = '/api/chat';
    const T2A_API_URL = '/api/t2a';
    const FILE_UPLOAD_URL = '/api/files/upload';
    const VOICE_CLONE_URL = '/api/voice/clone';
    const MUSIC_UPLOAD_URL = '/api/music/upload';
    const MUSIC_GENERATION_URL = '/api/music/generate';
    const VIDEO_GEN_URL = '/api/video/generate';
    const VIDEO_STATUS_URL = '/api/video/status';
    const VIDEO_DOWNLOAD_URL = '/api/video/download';

    let lastAiMessage = '';
    let conversationHistory = [];
    let currentAudioContext = null;
    let currentAudioSource = null;
    let clonedVoices = new Set();

    // Music generation elements
    const musicFile = document.getElementById('music-file');
    const uploadPurpose = document.getElementById('upload-purpose');
    const uploadMusicBtn = document.getElementById('upload-music');
    const voiceIdRef = document.getElementById('voice-id-ref');
    const instrumentalIdRef = document.getElementById('instrumental-id-ref');
    const lyricsInput = document.getElementById('lyrics-input');
    const useVoiceRef = document.getElementById('use-voice');
    const useInstrumentalRef = document.getElementById('use-instrumental');
    const generateMusicBtn = document.getElementById('generate-music');
    const resultAudio = document.getElementById('result-audio');
    const downloadMusicBtn = document.getElementById('download-music');
    const musicResult = document.querySelector('.music-result');

    // Voice cloning elements
    const voiceFile = document.getElementById('voice-file');
    const voiceId = document.getElementById('voice-id');
    const noiseReduction = document.getElementById('noise-reduction');
    const previewText = document.getElementById('preview-text');
    const cloneButton = document.getElementById('clone-voice');

    // Get video generation elements
    const videoPrompt = document.getElementById('video-prompt');
    const videoModel = document.getElementById('video-model');
    const promptOptimizer = document.getElementById('prompt-optimizer');
    const firstFrameInput = document.getElementById('first-frame');
    const subjectRefInput = document.getElementById('subject-ref');
    const generateVideoBtn = document.getElementById('generate-video');
    const videoStatus = document.querySelector('.video-status');
    const statusText = document.getElementById('status-text');
    const progressBar = document.querySelector('.progress');
    const videoResult = document.querySelector('.video-result');
    const resultVideo = document.getElementById('result-video');
    const downloadVideoBtn = document.getElementById('download-video');

    if (cloneButton) cloneButton.addEventListener('click', cloneVoice);
    if (uploadMusicBtn) uploadMusicBtn.addEventListener('click', uploadMusic);
    if (generateMusicBtn) generateMusicBtn.addEventListener('click', generateMusic);
    if (downloadMusicBtn) downloadMusicBtn.addEventListener('click', downloadGeneratedMusic);
    if (generateVideoBtn) generateVideoBtn.addEventListener('click', generateVideo);
    if (downloadVideoBtn) downloadVideoBtn.addEventListener('click', downloadGeneratedVideo);
    if (videoModel) videoModel.addEventListener('change', handleModelChange);

    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (speakButton) speakButton.addEventListener('click', () => synthesizeSpeech(lastAiMessage));
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Disable input during processing
        userInput.disabled = true;
        sendButton.disabled = true;
        document.querySelector('.input-area').classList.add('loading');

        let typingIndicator = null;
        let timeoutId = null;

        try {
            // Clear input and show user message immediately
            userInput.value = '';
            userInput.style.height = 'auto';
            displayMessage('user', message);
            
            // Add to conversation history
            conversationHistory.push({
                role: 'user',
                content: message
            });
            
            // Show typing indicator
            typingIndicator = document.createElement('div');
            typingIndicator.className = 'message bot typing';
            typingIndicator.innerHTML = `
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            `;
            chatLog.appendChild(typingIndicator);
            chatLog.scrollTop = chatLog.scrollHeight;

            // Add timeout for API response
            timeoutId = setTimeout(() => {
                if (typingIndicator) {
                    typingIndicator.remove();
                    typingIndicator = null;
                }
                userInput.disabled = false;
                sendButton.disabled = false;
                document.querySelector('.input-area').classList.remove('loading');
                displayMessage('bot', 'The response is taking longer than expected. Please try again.');
            }, 30000); // 30 second timeout

            // Make API request
            const response = await fetch(CHAT_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: conversationHistory
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                const aiMessage = data.choices[0].message.content;
                lastAiMessage = aiMessage;
                displayMessage('bot', aiMessage);
                
                conversationHistory.push({
                    role: 'assistant',
                    content: aiMessage
                });
            } else {
                throw new Error('No response from API');
            }
        } catch (error) {
            console.error('Chat API Error:', error);
            displayMessage('bot', `Error: ${error.message}`);
        } finally {
            // Clean up in finally block to ensure it always runs
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            if (typingIndicator) {
                typingIndicator.remove();
            }
            userInput.disabled = false;
            sendButton.disabled = false;
            document.querySelector('.input-area').classList.remove('loading');
            userInput.focus();
        }
    }

    async function synthesizeSpeech(text) {
        if (!text) return;
        
        // Stop any currently playing audio
        if (currentAudioSource) {
            currentAudioSource.stop();
            currentAudioSource = null;
        }
        if (currentAudioContext) {
            currentAudioContext.close();
            currentAudioContext = null;
        }

        try {
            const response = await fetch(T2A_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    stream: streamToggle.checked,
                    voice_setting: {
                        voice_id: voiceSelect.value,
                        speed: parseFloat(speedControl.value),
                        vol: parseFloat(volumeControl.value),
                        pitch: parseInt(pitchControl.value)
                    },
                    language_boost: languageBoost.value === 'auto' ? null : languageBoost.value
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            if (streamToggle.checked) {
                const reader = response.body.getReader();
                const audioChunks = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    // Process the streaming chunk
                    const chunk = new TextDecoder().decode(value);
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            const data = JSON.parse(line.slice(5));
                            if (data.data && data.data.audio) {
                                audioChunks.push(data.data.audio);
                                await playAudioChunk(data.data.audio);
                            }
                        }
                    }
                }
            } else {
                const data = await response.json();
                if (data.data && data.data.audio) {
                    await playAudioChunk(data.data.audio);
                } else {
                    throw new Error('No audio data in response');
                }
            }
        } catch (error) {
            console.error('T2A API Error:', error);
            displayMessage('ai', `Error synthesizing speech: ${error.message}`);
        }
    }

    async function playAudioChunk(audioHex) {
        try {
            const audioData = atob(audioHex);
            const audioArray = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
            }

            currentAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await currentAudioContext.decodeAudioData(audioArray.buffer);
            currentAudioSource = currentAudioContext.createBufferSource();
            currentAudioSource.buffer = audioBuffer;
            currentAudioSource.connect(currentAudioContext.destination);
            currentAudioSource.start(0);

            return new Promise((resolve) => {
                currentAudioSource.onended = () => {
                    resolve();
                };
            });
        } catch (error) {
            console.error('Audio playback error:', error);
            throw error;
        }
    }

    async function cloneVoice() {
        const file = voiceFile.files[0];
        if (!file) {
            displayMessage('ai', 'Please select a voice file to clone');
            return;
        }

        const voiceIdValue = voiceId.value.trim();
        if (!voiceIdValue || !/^[a-zA-Z][a-zA-Z0-9]{7,}$/.test(voiceIdValue)) {
            displayMessage('ai', 'Please enter a valid voice ID (start with letter, min 8 characters)');
            return;
        }

        try {
            // Upload file
            const formData = new FormData();
            formData.append('file', file);
            formData.append('purpose', 'voice_clone');

            const uploadResponse = await fetch(FILE_UPLOAD_URL, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('File upload failed');
            }

            const uploadData = await uploadResponse.json();
            const fileId = uploadData.file.file_id;

            // Clone voice
            const cloneResponse = await fetch(VOICE_CLONE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_id: fileId,
                    voice_id: voiceIdValue,
                    noise_reduction: noiseReduction.checked,
                    text: previewText.value || undefined,
                    model: 'speech-01-turbo'
                })
            });

            if (!cloneResponse.ok) {
                throw new Error('Voice cloning failed');
            }

            const cloneData = await cloneResponse.json();
            if (cloneData.base_resp.status_code === 0) {
                clonedVoices.add(voiceIdValue);
                
                // Add the cloned voice to the voice select dropdown
                const option = document.createElement('option');
                option.value = voiceIdValue;
                option.textContent = `Cloned Voice: ${voiceIdValue}`;
                voiceSelect.appendChild(option);
                
                displayMessage('ai', `Voice cloned successfully! Voice ID: ${voiceIdValue}`);
                
                // If preview text was provided, synthesize it with the new voice
                if (previewText.value) {
                    await synthesizeSpeech(previewText.value);
                }
            } else {
                throw new Error(cloneData.base_resp.status_msg || 'Voice cloning failed');
            }
        } catch (error) {
            console.error('Voice cloning error:', error);
            displayMessage('ai', `Error cloning voice: ${error.message}`);
        }
    }

    async function uploadMusic() {
        const file = musicFile.files[0];
        if (!file) {
            displayMessage('ai', 'Please select a music file to upload');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('purpose', uploadPurpose.value);

            const response = await fetch(MUSIC_UPLOAD_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Music upload failed');
            }

            const data = await response.json();
            if (data.base_resp.status_code === 0) {
                if (data.voice_id) {
                    voiceIdRef.value = data.voice_id;
                }
                if (data.instrumental_id) {
                    instrumentalIdRef.value = data.instrumental_id;
                }
                displayMessage('ai', 'Music uploaded successfully!');
            } else {
                throw new Error(data.base_resp.status_msg || 'Music upload failed');
            }
        } catch (error) {
            console.error('Music upload error:', error);
            displayMessage('ai', `Error uploading music: ${error.message}`);
        }
    }

    async function generateMusic() {
        if (!useVoiceRef.checked && !useInstrumentalRef.checked) {
            displayMessage('ai', 'Please select at least one reference (voice or instrumental)');
            return;
        }

        if (!lyricsInput.value.trim()) {
            displayMessage('ai', 'Please enter lyrics for the music');
            return;
        }

        const requestBody = {
            model: 'music-01',
            lyrics: lyricsInput.value.trim(),
            audio_setting: {
                sample_rate: 44100,
                bitrate: 256000,
                format: 'mp3'
            }
        };

        if (useVoiceRef.checked && voiceIdRef.value) {
            requestBody.refer_voice = voiceIdRef.value;
        }

        if (useInstrumentalRef.checked && instrumentalIdRef.value) {
            requestBody.refer_instrumental = instrumentalIdRef.value;
        }

        try {
            const response = await fetch(MUSIC_GENERATION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error('Music generation failed');
            }

            const data = await response.json();
            if (data.base_resp.status_code === 0 && data.data && data.data.audio) {
                const audioData = atob(data.data.audio);
                const audioBlob = new Blob([new Uint8Array(audioData.length).map((_, i) => audioData.charCodeAt(i))], { type: 'audio/mp3' });
                resultAudio.src = URL.createObjectURL(audioBlob);
                musicResult.style.display = 'block';
                displayMessage('ai', 'Music generated successfully!');
            } else {
                throw new Error(data.base_resp.status_msg || 'Music generation failed');
            }
        } catch (error) {
            console.error('Music generation error:', error);
            displayMessage('ai', `Error generating music: ${error.message}`);
        }
    }

    async function downloadGeneratedMusic() {
        if (resultAudio.src) {
            const response = await fetch(resultAudio.src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'generated_music.mp3';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
    }

    function displayMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        try {
            // Format code blocks and line breaks
            const formattedMessage = message
                .replace(/```(\w+)?\n([\s\S]*?)\n```/g, (_, lang, code) => 
                    `<pre><code class="${lang || ''}">${code.trim()}</code></pre>`)
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
            
            messageDiv.innerHTML = formattedMessage;
            
            // Add error styling for error messages
            if (message.startsWith('Error:')) {
                messageDiv.classList.add('error');
            }
            
            chatLog.appendChild(messageDiv);
            chatLog.scrollTop = chatLog.scrollHeight;
            
            // Play sound for new messages
            if (sender === 'bot') {
                const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAABQADw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8VFRUVFRUVFRUVFRUVFRUVFRUVFRUVFR4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQAAAAOTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
                audio.volume = 0.2;
                audio.play().catch(() => {}); // Ignore autoplay errors
            }
        } catch (error) {
            console.error('Error displaying message:', error);
            messageDiv.textContent = message; // Fallback to plain text
            chatLog.appendChild(messageDiv);
            chatLog.scrollTop = chatLog.scrollHeight;
        }
    }

    // Initialize chat
    const welcomeMessage = 'Hello! I am MiniMax AI. How can I help you today?';
    displayMessage('bot', welcomeMessage);
    conversationHistory = [{
        role: 'assistant',
        content: welcomeMessage
    }];

    // Keyboard shortcuts
    const shortcuts = {
        'Enter': (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !userInput.disabled) {
                e.preventDefault();
                sendMessage();
            }
        },
        'Escape': (e) => {
            if (document.activeElement === userInput) {
                e.preventDefault();
                userInput.value = '';
                userInput.style.height = 'auto';
            }
        },
        'v': (e) => {
            if (e.altKey) {
                e.preventDefault();
                document.getElementById('toggle-voice').click();
            }
        },
        's': (e) => {
            if (e.altKey && lastAiMessage) {
                e.preventDefault();
                speakButton.click();
            }
        }
    };

    document.addEventListener('keydown', (e) => {
        const handler = shortcuts[e.key];
        if (handler) handler(e);
    });

    // Handle voice toggle and settings
    const toggleVoice = document.getElementById('toggle-voice');
    if (toggleVoice) {
        toggleVoice.addEventListener('click', () => {
            const isEnabled = streamToggle.checked;
            streamToggle.checked = !isEnabled;
            toggleVoice.textContent = isEnabled ? '🔊' : '🔇';
            
            // Show tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'status-indicator visible';
            tooltip.textContent = `Voice ${isEnabled ? 'disabled' : 'enabled'}`;
            document.querySelector('.voice-controls').appendChild(tooltip);
            setTimeout(() => tooltip.remove(), 2000);
        });
    }

    // Update voice control tooltips
    document.querySelectorAll('.voice-controls input[type="range"]').forEach(input => {
        const updateTooltip = () => {
            const label = input.closest('.voice-control-group')?.dataset.label;
            if (label) {
                input.title = `${label}: ${input.value}`;
            }
        };
        input.addEventListener('input', updateTooltip);
        updateTooltip();
    });

    function handleModelChange() {
        const subjectUpload = document.querySelector('.subject-upload');
        if (videoModel.value === 'S2V-01') {
            subjectUpload.style.display = 'block';
        } else {
            subjectUpload.style.display = 'none';
        }
    }

    async function generateVideo() {
        if (!videoPrompt.value.trim()) {
            displayMessage('ai', 'Please enter a prompt for the video');
            return;
        }

        const formData = new FormData();
        
        // Add first frame image if provided
        if (firstFrameInput.files.length > 0) {
            const firstFrameResponse = await fetch(FILE_UPLOAD_URL, {
                method: 'POST',
                body: (() => {
                    const fd = new FormData();
                    fd.append('file', firstFrameInput.files[0]);
                    fd.append('purpose', 'first_frame');
                    return fd;
                })()
            });
            
            if (!firstFrameResponse.ok) {
                throw new Error('Failed to upload first frame image');
            }
            
            const firstFrameData = await firstFrameResponse.json();
            formData.append('first_frame_image', firstFrameData.file_id);
        }

        // Add subject reference if using S2V-01 model
        if (videoModel.value === 'S2V-01' && subjectRefInput.files.length > 0) {
            const subjectResponse = await fetch(FILE_UPLOAD_URL, {
                method: 'POST',
                body: (() => {
                    const fd = new FormData();
                    fd.append('file', subjectRefInput.files[0]);
                    fd.append('purpose', 'subject_reference');
                    return fd;
                })()
            });
            
            if (!subjectResponse.ok) {
                throw new Error('Failed to upload subject reference image');
            }
            
            const subjectData = await subjectResponse.json();
            formData.append('subject_reference', subjectData.file_id);
        }

        try {
            generateVideoBtn.disabled = true;
            videoStatus.style.display = 'block';
            statusText.textContent = 'Generating video...';
            progressBar.style.width = '0%';

            const response = await fetch(VIDEO_GEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: videoModel.value,
                    prompt: videoPrompt.value.trim(),
                    prompt_optimizer: promptOptimizer.checked,
                    first_frame_image: formData.get('first_frame_image'),
                    subject_reference: formData.get('subject_reference')
                })
            });

            if (!response.ok) {
                throw new Error('Video generation failed');
            }

            const data = await response.json();
            if (data.base_resp.status_code === 0 && data.task_id) {
                await checkVideoStatus(data.task_id);
            } else {
                throw new Error(data.base_resp.status_msg || 'Video generation failed');
            }
        } catch (error) {
            console.error('Video generation error:', error);
            displayMessage('ai', `Error generating video: ${error.message}`);
            videoStatus.style.display = 'none';
        } finally {
            generateVideoBtn.disabled = false;
        }
    }

    async function checkVideoStatus(taskId) {
        try {
            while (true) {
                const response = await fetch(`${VIDEO_STATUS_URL}?task_id=${taskId}`);
                if (!response.ok) {
                    throw new Error('Failed to check video status');
                }

                const data = await response.json();
                if (data.base_resp.status_code !== 0) {
                    throw new Error(data.base_resp.status_msg || 'Status check failed');
                }

                const progress = data.progress || 0;
                progressBar.style.width = `${progress}%`;
                statusText.textContent = `Generating video... ${progress}%`;

                if (data.status === 'completed' && data.file_id) {
                    await downloadVideo(data.file_id);
                    break;
                } else if (data.status === 'failed') {
                    throw new Error('Video generation failed');
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            throw error;
        }
    }

    async function downloadVideo(fileId) {
        try {
            const response = await fetch(`${VIDEO_DOWNLOAD_URL}?file_id=${fileId}`);
            if (!response.ok) {
                throw new Error('Failed to download video');
            }

            const data = await response.json();
            if (data.base_resp.status_code === 0 && data.url) {
                resultVideo.src = data.url;
                videoResult.style.display = 'block';
                videoStatus.style.display = 'none';
                displayMessage('ai', 'Video generated successfully!');
            } else {
                throw new Error(data.base_resp.status_msg || 'Download failed');
            }
        } catch (error) {
            throw error;
        }
    }

    async function downloadGeneratedVideo() {
        if (resultVideo.src) {
            const response = await fetch(resultVideo.src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'generated_video.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
    }

    // Auto-resize textarea
    if (userInput) {
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
        });

        // Clear input on Escape
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                userInput.value = '';
                userInput.style.height = 'auto';
            }
        });
    }
});
