const express = require('express');
const path = require('path');
const https = require('https');
require('dotenv').config();

const app = express();

// API URLs
const CHAT_API_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2';
const T2A_API_URL = 'https://api.minimaxi.chat/v1/t2a_v2';
const VIDEO_GEN_API_URL = 'https://api.minimaxi.chat/v1/video_generation';
const VIDEO_QUERY_API_URL = 'https://api.minimaxi.chat/v1/query/video_generation';
const FILE_RETRIEVE_API_URL = 'https://api.minimaxi.chat/v1/files/retrieve';

const MAX_AUDIO_SIZE = process.env.MAX_AUDIO_SIZE || 20971520; // 20MB
const MIN_AUDIO_DURATION = process.env.MIN_AUDIO_DURATION || 10;
const MAX_AUDIO_DURATION = process.env.MAX_AUDIO_DURATION || 300;

// Helper function to make API requests
async function makeRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let responseData = '';
            res.on('data', chunk => { responseData += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    console.log('API Response:', JSON.stringify(parsedData, null, 2));
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        // Check for MiniMax API specific response format
                        if (parsedData.base_resp && parsedData.base_resp.status_code === 0) {
                            if (parsedData.choices && parsedData.choices.length > 0) {
                                resolve(parsedData.choices[0].message.content);
                            } else {
                                console.error('No choices found in response:', parsedData);
                                reject(new Error('No choices found in API response'));
                            }
                        } else if (parsedData.base_resp) {
                            reject(new Error(parsedData.base_resp.status_msg || 'API request failed'));
                        } else {
                            resolve(parsedData);
                        }
                    } else {
                        reject(new Error(parsedData.message || parsedData.base_resp?.status_msg || 'API request failed'));
                    }
                } catch (error) {
                    console.error('Response parsing error:', error, 'Raw response:', responseData);
                    reject(new Error('Failed to parse API response'));
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Validate environment variables
if (!process.env.MINIMAX_API_KEY || !process.env.MINIMAX_GROUP_ID) {
    console.error('Error: MINIMAX_API_KEY and MINIMAX_GROUP_ID must be set in .env file');
    process.exit(1);
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4'
};

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Parse POST body data
async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Add CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
            console.log('Chat request body:', JSON.stringify(req.body, null, 2));
            
            const response = await makeRequest(
                `${CHAT_API_URL}?GroupId=${process.env.MINIMAX_GROUP_ID}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                },
                {
                    model: 'MiniMax-Text-01',
                    messages: req.body.messages,
                    temperature: 0.1,
                    max_tokens: 1000,
                    top_p: 0.95,
                    mask_sensitive_info: false
                }
            );

            console.log('Processed API response:', response);

            // Format the response to match what the client expects
            const formattedResponse = {
                choices: [{
                    message: {
                        content: response,
                        role: 'assistant'
                    }
                }]
            };

            console.log('Sending formatted response:', JSON.stringify(formattedResponse, null, 2));
            res.json(formattedResponse);
    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ 
            error: 'Failed to get response from chat API',
            details: error.message 
        });
    }
});

// Text to speech endpoint
app.post('/api/t2a', async (req, res) => {
    try {
        const response = await makeRequest(
            `${T2A_API_URL}?GroupId=${process.env.MINIMAX_GROUP_ID}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            },
            {
                model: 'speech-01-turbo',
                text: req.body.text,
                stream: req.body.stream || false,
                voice_setting: req.body.voice_setting,
                audio_setting: {
                    sample_rate: 32000,
                    bitrate: 128000,
                    format: 'mp3',
                    channel: 1
                },
                language_boost: req.body.language_boost
            }
        );
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Video generation endpoint
app.post('/api/video/generate', async (req, res) => {
    try {
        const response = await makeRequest(
            VIDEO_GEN_API_URL,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            },
            {
                model: req.body.model || 'video-01',
                prompt: req.body.prompt,
                prompt_optimizer: req.body.prompt_optimizer !== false,
                first_frame_image: req.body.first_frame_image,
                subject_reference: req.body.subject_reference
            }
        );
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Video status endpoint
app.get('/api/video/status', async (req, res) => {
    try {
        const { task_id } = req.query;
        if (!task_id) {
            return res.status(400).json({ error: 'Missing task_id parameter' });
        }

        const response = await makeRequest(
            `${VIDEO_QUERY_API_URL}?task_id=${task_id}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Video download endpoint
app.get('/api/video/download', async (req, res) => {
    try {
        const { file_id } = req.query;
        if (!file_id) {
            return res.status(400).json({ error: 'Missing file_id parameter' });
        }

        const response = await makeRequest(
            `${FILE_RETRIEVE_API_URL}?GroupId=${process.env.MINIMAX_GROUP_ID}&file_id=${file_id}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API error handling middleware
app.use('/api', (err, req, res, next) => {
    console.error('API Error:', err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

// Serve static files
app.use(express.static(path.join(__dirname), {
    index: false // Disable automatic serving of index.html
}));

// Handle API 404s
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Serve index.html for all other routes (SPA)
app.use('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global Error:', err.stack);
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ error: 'Internal Server Error' });
    } else {
        res.status(500).send('Internal Server Error');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
