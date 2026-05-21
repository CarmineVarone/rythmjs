const http = require('http');
const fs   = require('fs');
const path = require('path');
const Busboy = require('busboy');

const SONGS_DIR = path.join(__dirname, 'songs');
if (!fs.existsSync(SONGS_DIR)) fs.mkdirSync(SONGS_DIR);

// ── Helpers ────────────────────────────────────────────────
function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html', '.js': 'application/javascript',
    '.css': 'text/css',   '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',  '.ogg': 'audio/ogg',
    '.json': 'application/json'
  };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}
function safeName(name) {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 80);
}

// ── Song list ──────────────────────────────────────────────
const DIFF_SUFFIXES = ['_Easy','_Normal','_Hard','_Legend'];

function findAudioForId(files, id) {
  const exts = ['.mp3','.wav','.ogg'];
  // Direct match
  for (const ext of exts) {
    if (files.includes(id + ext)) return id + ext;
  }
  // Strip known difficulty suffix and try again
  for (const suf of DIFF_SUFFIXES) {
    if (id.endsWith(suf)) {
      const base = id.slice(0, -suf.length);
      for (const ext of exts) {
        if (files.includes(base + ext)) return base + ext;
      }
    }
  }
  return null;
}

function getSongList() {
  const files = fs.readdirSync(SONGS_DIR);
  const songs = [];
  files.filter(f => f.endsWith('.json')).forEach(f => {
    try {
      const meta      = JSON.parse(fs.readFileSync(path.join(SONGS_DIR, f), 'utf8'));
      const id        = path.basename(f, '.json');
      const audioRef  = meta.audioRef || null;
      const audioFile = audioRef && files.includes(audioRef)
        ? audioRef
        : findAudioForId(files, id);
      if (audioFile) {
        songs.push({
          id,
          title:      meta.title      || id,
          artist:     meta.artist     || 'Unknown',
          bpm:        meta.bpm        || 120,
          difficulty: meta.difficulty || 'Normal',
          noteCount:  (meta.notes     || []).length,
          audioFile
        });
      }
    } catch {}
  });
  return songs;
}

// ── HTTP Server ────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(); return;
  }

  // ── GET routes ───────────────────────────────────────────
  if (req.method === 'GET') {
    if (url === '/' || url === '/index.html') {
      sendFile(res, path.join(__dirname, 'index.html')); return;
    }
    if (url === '/api/songs') {
      sendJSON(res, getSongList()); return;
    }
    if (url.startsWith('/api/map/')) {
      const id = safeName(url.slice(9));
      const mapPath = path.join(SONGS_DIR, id + '.json');
      if (fs.existsSync(mapPath)) sendFile(res, mapPath);
      else sendJSON(res, { error: 'Map not found' }, 404);
      return;
    }
    if (url.startsWith('/songs/')) {
      const file = safeName(path.basename(url));
      sendFile(res, path.join(SONGS_DIR, file)); return;
    }
    res.writeHead(404); res.end('Not found'); return;
  }

  // ── POST: upload song (multipart) ────────────────────────
  if (req.method === 'POST' && url === '/api/upload') {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });
    let audioFileName = null;
    let fields = {};
    let fileError = null;

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      if (!filename) { file.resume(); return; }
      const ext = path.extname(filename).toLowerCase();
      if (!['.mp3','.wav','.ogg'].includes(ext)) {
        file.resume(); fileError = 'Formato non supportato (usa MP3, WAV o OGG)'; return;
      }
      const base = safeName(path.basename(filename, ext));
      audioFileName = base + ext;
      const outPath = path.join(SONGS_DIR, audioFileName);
      const ws = fs.createWriteStream(outPath);
      file.pipe(ws);
      ws.on('error', () => { fileError = 'Errore scrittura file'; });
    });

    bb.on('finish', () => {
      if (fileError) { sendJSON(res, { error: fileError }, 400); return; }
      if (!audioFileName) { sendJSON(res, { error: 'Nessun file audio' }, 400); return; }

      const base = path.basename(audioFileName, path.extname(audioFileName));
      const mapPath = path.join(SONGS_DIR, base + '.json');

      // Create empty map if doesn't exist
      if (!fs.existsSync(mapPath)) {
        const map = {
          title:      fields.title  || base,
          artist:     fields.artist || 'Unknown',
          bpm:        parseFloat(fields.bpm) || 120,
          difficulty: fields.difficulty || 'Normal',
          offset:     parseFloat(fields.offset) || 0,
          notes:      []
        };
        fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
      }
      sendJSON(res, { ok: true, id: base, audioFile: audioFileName });
    });

    req.pipe(bb);
    return;
  }

  // ── POST: save map ────────────────────────────────────────
  if (req.method === 'POST' && url === '/api/savemap') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.id) { sendJSON(res, { error: 'Missing id' }, 400); return; }
        const id = safeName(data.id);
        const mapPath = path.join(SONGS_DIR, id + '.json');
        // Find audio: direct match or via audioRef or strip diff suffix
        const files = fs.readdirSync(SONGS_DIR);
        const audioRef = data.audioRef || null;
        const audioExists = audioRef
          ? files.includes(audioRef)
          : findAudioForId(files, id) !== null;
        if (!audioExists) { sendJSON(res, { error: 'Audio non trovato per: ' + id }, 404); return; }
        const map = {
          title:      data.title      || id,
          artist:     data.artist     || 'Unknown',
          bpm:        data.bpm        || 120,
          difficulty: data.difficulty || 'Normal',
          offset:     data.offset     || 0,
          notes:      data.notes      || [],
          ...(audioRef ? { audioRef } : {})
        };
        fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
        sendJSON(res, { ok: true, noteCount: map.notes.length });
      } catch (e) {
        sendJSON(res, { error: 'JSON non valido' }, 400);
      }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎸 Rhythm Game Server`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   Canzoni salvate in: ${SONGS_DIR}\n`);
});
