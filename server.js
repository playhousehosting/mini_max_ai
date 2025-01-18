const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');
require('dotenv').config();

// API URLs
const CHAT_API_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2';
const T2A_API_URL = 'https://api.minimaxi.chat/v1/t2a_v2';
const VIDEO_GEN_API_URL = 'https://api.minimaxi.chat/v1/video_generation';
const VIDEO_QUERY_API_URL = 'https://api.minimaxi.chat/v1/query/video_generation';
const FILE_RETRIEVE_API_URL = 'https://api.minimaxi.chat/v1/files/retrieve';

// Server configuration
const PORT = process.env.PORT || 3000;
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
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject(new Error(parsedData.message || 'API request failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
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

const server = http.createServer(async (req, res) => {
    // Add CORS headers to all responses
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // Handle OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url);
    
    // API endpoints
    if (parsedUrl.pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        
        try {
            switch (parsedUrl.pathname) {
                case '/api/chat':
                    if (req.method === 'POST') {
                        const body = await parseBody(req);
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
                                messages: body.messages,
                                temperature: 0.1,
                                max_tokens: 1000,
                                mask_sensitive_info: false
                            }
                        );
                        res.writeHead(200);
                        res.end(JSON.stringify(response));
                    }
                    break;
                    
                case '/api/t2a':
                    if (req.method === 'POST') {
                        const body = await parseBody(req);
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
                                text: body.text,
                                stream: body.stream || false,
                                voice_setting: body.voice_setting,
                                audio_setting: {
                                    sample_rate: 32000,
                                    bitrate: 128000,
                                    format: 'mp3',
                                    channel: 1
                                },
                                language_boost: body.language_boost
                            }
                        );
                        res.writeHead(200);
                        res.end(JSON.stringify(response));
                    }
                    break;

                case '/api/video/generate':
                    if (req.method === 'POST') {
                        const body = await parseBody(req);
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
                                model: body.model || 'video-01',
                                prompt: body.prompt,
                                prompt_optimizer: body.prompt_optimizer !== false,
                                first_frame_image: body.first_frame_image,
                                subject_reference: body.subject_reference
                            }
                        );
                        res.writeHead(200);
                        res.end(JSON.stringify(response));
                    }
                    break;

                case '/api/video/status':
                    if (req.method === 'GET') {
                        const taskId = url.parse(req.url, true).query.task_id;
                        if (!taskId) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'Missing task_id parameter' }));
                            return;
                        }

                        const response = await makeRequest(
                            `${VIDEO_QUERY_API_URL}?task_id=${taskId}`,
                            {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        res.writeHead(200);
                        res.end(JSON.stringify(response));
                    }
                    break;

                case '/api/video/download':
                    if (req.method === 'GET') {
                        const fileId = url.parse(req.url, true).query.file_id;
                        if (!fileId) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ error: 'Missing file_id parameter' }));
                            return;
                        }

                        const response = await makeRequest(
                            `${FILE_RETRIEVE_API_URL}?GroupId=${process.env.MINIMAX_GROUP_ID}&file_id=${fileId}`,
                            {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        res.writeHead(200);
                        res.end(JSON.stringify(response));
                    }
                    break;
                    
                default:
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Serve static files
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    try {
        const content = await fs.promises.readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(500);
            res.end('Server error: ' + error.code);
        }
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Test page available at http://localhost:${PORT}/test.html`);
});
