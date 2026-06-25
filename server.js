const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file or migrate if it has legacy schema
if (fs.existsSync(DATA_FILE)) {
    try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (!parsed.users) {
            // Migrate legacy structure to dynamic users schema
            const migrated = {
                cycleKey: parsed.cycleKey || "",
                users: {
                    Brodie: parsed.brodie || 0,
                    Ned: parsed.ned || 0
                }
            };
            fs.writeFileSync(DATA_FILE, JSON.stringify(migrated, null, 2));
        }
    } catch (e) {
        // Re-initialize if JSON is corrupt
        fs.writeFileSync(DATA_FILE, JSON.stringify({ cycleKey: "", users: { Brodie: 0, Ned: 0 } }, null, 2));
    }
} else {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ cycleKey: "", users: { Brodie: 0, Ned: 0 } }, null, 2));
}

const server = http.createServer((req, res) => {
    // Enable CORS for all routes (to support running client from file:// or other local servers)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Parse URL path
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/' || url.pathname === '/index.html') {
        // Serve index.html
        fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
    } else if (url.pathname === '/api/counts') {
        if (req.method === 'GET') {
            fs.readFile(DATA_FILE, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to read data' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        } else if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const parsedData = JSON.parse(body);
                    // Dynamic validation
                    if (typeof parsedData.users !== 'object' || parsedData.users === null) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid data format: users must be an object' }));
                        return;
                    }
                    for (const user in parsedData.users) {
                        if (typeof parsedData.users[user] !== 'number') {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: `Invalid count for user ${user}` }));
                            return;
                        }
                    }
                    
                    fs.writeFile(DATA_FILE, JSON.stringify(parsedData, null, 2), 'utf8', (err) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to save data' }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Data saved successfully' }));
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
