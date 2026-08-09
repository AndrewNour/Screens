const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 7860;
const DATA_FILE = path.join(__dirname, 'ads.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

let currentPlayingAdId = null;

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Enable CORS and body parsing
app.use(cors());
app.use(express.json({ limit: '300mb' }));
app.use(express.urlencoded({ limit: '300mb', extended: true }));

// Serve static files
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Save with unique name but keep extension
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 300 * 1024 * 1024 } // 300MB limit
});

// Helper: Load ads
function getAds() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]));
      return [];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading ads database:', err);
    // Auto-repair corrupt database
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    } catch(e) {}
    return [];
  }
}

// Helper: Save ads
function saveAds(ads) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(ads, null, 2));
    broadcast({ type: 'reload' });
    return true;
  } catch (err) {
    console.error('Error writing ads database:', err);
    return false;
  }
}

// Helper: Delete media file
function deleteMediaFile(filePath) {
  if (!filePath) return;
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath) && fullPath.startsWith(UPLOADS_DIR)) {
    fs.unlink(fullPath, (err) => {
      if (err) console.error(`Failed to delete media file: ${fullPath}`, err);
      else console.log(`Deleted media file: ${fullPath}`);
    });
  }
}

// Socket.io broadcast
function broadcast(data) {
  io.emit('message', data);
}

// REST APIs
// 1. Get all ads
app.get('/api/ads', (req, res) => {
  res.json(getAds());
});

// 2. Create ad (with file upload)
app.post('/api/ads', upload.single('media'), (req, res) => {
  try {
    const ads = getAds();
    const nextId = ads.length ? Math.max(...ads.map(a => a.id)) + 1 : 1;

    let mediaPath = '';
    let mediaType = '';

    if (req.file) {
      mediaPath = `uploads/${req.file.filename}`;
      const mime = req.file.mimetype.toLowerCase();
      mediaType = mime.startsWith('video/') ? 'video' : 'image';
    } else {
      return res.status(400).json({ error: 'Media file is required' });
    }

    // Parse day scheduling
    let days = [];
    if (req.body.days) {
      try {
        days = JSON.parse(req.body.days);
      } catch (e) {
        days = req.body.days.split(',').map(Number).filter(n => !isNaN(n));
      }
    }

    const duration = req.body.duration ? Number(req.body.duration) : 10;
    const active = req.body.active === 'true';
    const muted = req.body.muted === 'true'; // True = silent, False = sound
    const expiresAt = req.body.expiresAt || null;
    const startTime = req.body.startTime || null;
    const endTime = req.body.endTime || null;
    const showDetails = req.body.showDetails === 'true';

    const newAd = {
      id: nextId,
      title: req.body.title || 'Untitled Ad',
      category: req.body.category || '',
      desc: req.body.desc || '',
      src: mediaPath,
      type: mediaType,
      duration: duration,
      bg: 'ph-1', // Default bg class
      glowColor: '#6366f1',
      expiresAt: expiresAt,
      active: active,
      muted: muted,
      days: days,
      startTime: startTime,
      endTime: endTime,
      showDetails: showDetails
    };

    ads.push(newAd);
    if (saveAds(ads)) {
      res.status(201).json(newAd);
    } else {
      res.status(500).json({ error: 'Failed to save database' });
    }
  } catch (err) {
    console.error('Error creating ad:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Update ad details
app.put('/api/ads/:id', upload.single('media'), (req, res) => {
  try {
    const id = Number(req.params.id);
    const ads = getAds();
    const adIdx = ads.findIndex(a => a.id === id);

    if (adIdx === -1) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    const ad = ads[adIdx];

    // If new media is uploaded, replace the old one
    if (req.file) {
      deleteMediaFile(ad.src);
      ad.src = `uploads/${req.file.filename}`;
      const mime = req.file.mimetype.toLowerCase();
      ad.type = mime.startsWith('video/') ? 'video' : 'image';
    }

    if (req.body.title !== undefined) ad.title = req.body.title;
    if (req.body.category !== undefined) ad.category = req.body.category;
    if (req.body.desc !== undefined) ad.desc = req.body.desc;
    if (req.body.duration !== undefined) ad.duration = Number(req.body.duration);
    if (req.body.active !== undefined) ad.active = req.body.active === 'true';
    if (req.body.muted !== undefined) ad.muted = req.body.muted === 'true';
    if (req.body.expiresAt !== undefined) ad.expiresAt = req.body.expiresAt || null;
    if (req.body.startTime !== undefined) ad.startTime = req.body.startTime || null;
    if (req.body.endTime !== undefined) ad.endTime = req.body.endTime || null;
    if (req.body.showDetails !== undefined) ad.showDetails = req.body.showDetails === 'true';

    if (req.body.days !== undefined) {
      try {
        ad.days = JSON.parse(req.body.days);
      } catch (e) {
        ad.days = req.body.days.split(',').map(Number).filter(n => !isNaN(n));
      }
    }

    ads[adIdx] = ad;
    if (saveAds(ads)) {
      res.json(ad);
    } else {
      res.status(500).json({ error: 'Failed to save database' });
    }
  } catch (err) {
    console.error('Error updating ad:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Toggle active status
app.put('/api/ads/:id/active', (req, res) => {
  const id = Number(req.params.id);
  const ads = getAds();
  const ad = ads.find(a => a.id === id);

  if (!ad) return res.status(404).json({ error: 'Ad not found' });

  ad.active = !ad.active;
  if (saveAds(ads)) {
    res.json(ad);
  } else {
    res.status(500).json({ error: 'Failed to save database' });
  }
});

// 5. Update duration directly
app.put('/api/ads/:id/duration', (req, res) => {
  const id = Number(req.params.id);
  const ads = getAds();
  const ad = ads.find(a => a.id === id);

  if (!ad) return res.status(404).json({ error: 'Ad not found' });

  ad.duration = Math.max(3, Math.min(120, Number(req.body.duration)));
  if (saveAds(ads)) {
    res.json(ad);
  } else {
    res.status(500).json({ error: 'Failed to save database' });
  }
});

// 6. Delete ad
app.delete('/api/ads/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    let ads = getAds();
    const ad = ads.find(a => a.id === id);

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    deleteMediaFile(ad.src);
    ads = ads.filter(a => a.id !== id);

    if (saveAds(ads)) {
      res.json({ success: true, message: 'Ad deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save database' });
    }
  } catch (err) {
    console.error('Error deleting ad:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 7. Reorder ads
app.post('/api/ads/reorder', (req, res) => {
  try {
    const orderedIds = req.body.ids; // Array of IDs in the new order
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'Invalid payload: ids array is required' });
    }

    const ads = getAds();
    const reorderedAds = [];

    // Arrange ads in the order of orderedIds
    orderedIds.forEach(id => {
      const ad = ads.find(a => a.id === Number(id));
      if (ad) reorderedAds.push(ad);
    });

    // Add any ads that were not included in the orderedIds list just in case
    ads.forEach(ad => {
      if (!orderedIds.includes(ad.id)) {
        reorderedAds.push(ad);
      }
    });

    if (saveAds(reorderedAds)) {
      res.json({ success: true, message: 'Reordered successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save database' });
    }
  } catch (err) {
    console.error('Error reordering ads:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Serve uploads folder statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Default routing mapping to the front/ directory (defined BEFORE static middleware to override index.html)
app.get('/', (req, res) => {
  res.redirect('/admin');
});
app.get('/admin', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, '../front/admin.html'));
});
app.get('/screens', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, '../front/index.html'));
});

// Serve other static files from the front/ directory (disabling default index.html fallback)
app.use(express.static(path.join(__dirname, '../front'), { index: false }));

// Real-time Cron checking: Auto-delete expired ads every 5 seconds
setInterval(() => {
  try {
    const ads = getAds();
    const now = Date.now();
    let changed = false;

    const activeAds = [];
    const expiredAds = [];

    ads.forEach(ad => {
      if (ad.expiresAt && new Date(ad.expiresAt).getTime() < now) {
        expiredAds.push(ad);
        changed = true;
      } else {
        activeAds.push(ad);
      }
    });

    if (changed) {
      console.log(`Auto-deleting ${expiredAds.length} expired ads.`);
      expiredAds.forEach(ad => deleteMediaFile(ad.src));
      saveAds(activeAds); // Save will automatically trigger WebSocket broadcast reload
    }
  } catch (err) {
    console.error('Error in auto-expiry checker:', err);
  }
}, 5000);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('Client connected to Socket.io.');
  
  socket.isScreen = false;
  
  // Send current playing ad state to new client on connect
  socket.emit('message', { type: 'playing', adId: currentPlayingAdId });

  socket.on('message', (msg) => {
    try {
      if (msg.type === 'register' && msg.role === 'screen') {
        socket.isScreen = true;
        console.log('Screen registered on Socket.io.');
        if (currentPlayingAdId !== null) {
          socket.emit('message', { type: 'force-play', adId: currentPlayingAdId });
        }
        socket.emit('message', { type: 'set_fullscreen', fullscreen: getCurrentFullscreenState() });
      }
      if (msg.type === 'playing') {
        currentPlayingAdId = msg.adId;
        broadcast({ type: 'playing', adId: msg.adId });
      }
      if (msg.type === 'force-play') {
        currentPlayingAdId = msg.adId;
        broadcast({ type: 'force-play', adId: msg.adId });
        broadcast({ type: 'playing', adId: msg.adId });
      }
      if (msg.type === 'set_fullscreen') {
        broadcast({ type: 'set_fullscreen', fullscreen: msg.fullscreen });
      }
    } catch (err) {
      console.error('Error processing Socket.io message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from Socket.io.');
    if (socket.isScreen) {
      // Check if there are any screens left
      let screenCount = 0;
      const sockets = io.sockets.sockets;
      for (const [id, s] of sockets) {
        if (s.isScreen) {
          screenCount++;
        }
      }
      if (screenCount === 0) {
        console.log('All screens disconnected. Setting current playing ad to null.');
        currentPlayingAdId = null;
        broadcast({ type: 'playing', adId: null });
      }
    }
  });
});

// Start Server
// Timer handling
const TIMERS_FILE = path.join(__dirname, 'timers.json');
let timerState = {
  active: false,
  maxMins: 5,
  minMins: 2,
  startTime: null,
  intervalId: null,
};

function getCurrentFullscreenState() {
  if (!timerState.active || !timerState.startTime) {
    return true; // Default to Maximize (true) when the timer is not running
  }
  const maxMs = timerState.maxMins * 60 * 1000;
  const minMs = timerState.minMins * 60 * 1000;
  const totalCycleMs = maxMs + minMs;
  if (totalCycleMs === 0) return true;
  const elapsed = (Date.now() - timerState.startTime) % totalCycleMs;
  return elapsed < maxMs;
}

function loadTimer() {
  if (fs.existsSync(TIMERS_FILE)) {
    try {
      const raw = fs.readFileSync(TIMERS_FILE, 'utf8');
      const data = JSON.parse(raw);
      timerState = { ...timerState, ...data };
      if (timerState.active) {
        resumeTimer();
      }
    } catch (err) {
      console.error('Failed to load timer config', err);
    }
  }
}

function saveTimer() {
  try {
    const toSave = { ...timerState };
    delete toSave.intervalId;
    fs.writeFileSync(TIMERS_FILE, JSON.stringify(toSave, null, 2));
  } catch (err) {
    console.error('Failed to save timer config', err);
  }
}

function startTimer(maxMins, minMins) {
  if (timerState.intervalId) clearInterval(timerState.intervalId);
  timerState.active = true;
  timerState.maxMins = maxMins;
  timerState.minMins = minMins;
  timerState.startTime = Date.now();
  const maxMs = maxMins * 60 * 1000;
  const minMs = minMins * 60 * 1000;
  const totalCycleMs = maxMs + minMs;
  let isMax = true;
  // Immediately set fullscreen to maximize
  broadcast({ type: 'set_fullscreen', fullscreen: true });

  timerState.intervalId = setInterval(() => {
    const elapsed = (Date.now() - timerState.startTime) % totalCycleMs;
    const shouldBeMax = elapsed < maxMs;
    if (shouldBeMax !== isMax) {
      isMax = shouldBeMax;
      broadcast({ type: 'set_fullscreen', fullscreen: isMax });
    }
  }, 1000);
  saveTimer();
}

function stopTimer() {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerState.active = false;
  timerState.startTime = null;
  saveTimer();
}

function resumeTimer() {
  const maxMs = timerState.maxMins * 60 * 1000;
  const minMs = timerState.minMins * 60 * 1000;
  const totalCycleMs = maxMs + minMs;
  let isMax = true;
  const elapsedSinceStart = (Date.now() - timerState.startTime) % totalCycleMs;
  isMax = elapsedSinceStart < maxMs;
  broadcast({ type: 'set_fullscreen', fullscreen: isMax });

  timerState.intervalId = setInterval(() => {
    const elapsed = (Date.now() - timerState.startTime) % totalCycleMs;
    const shouldBeMax = elapsed < maxMs;
    if (shouldBeMax !== isMax) {
      isMax = shouldBeMax;
      broadcast({ type: 'set_fullscreen', fullscreen: isMax });
    }
  }, 1000);
}

// Load timer on startup
loadTimer();

// API endpoints for timer
app.get('/api/timer', (req, res) => {
  const { active, maxMins, minMins } = timerState;
  res.json({ success: true, active, maxMins, minMins });
});

app.post('/api/timer', (req, res) => {
  const { maxMins, minMins } = req.body;
  if (!maxMins || !minMins) {
    return res.status(400).json({ success: false, error: 'maxMins and minMins required' });
  }
  startTimer(Number(maxMins), Number(minMins));
  res.json({ success: true });
});

app.post('/api/timer/stop', (req, res) => {
  stopTimer();
  res.json({ success: true });
});

server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Server is running on: http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`Screens display: http://localhost:${PORT}/index.html`);
  console.log(`Upload file limit is set to: 300 MB`);
  console.log(`========================================`);
});
