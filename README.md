# 太鼓 DRUM — Rhythm Game

## Come aggiungere una canzone

### 1. Prepara i file
- `nome-canzone.mp3` — il file audio
- `nome-canzone_Normal.json` — la mappa delle note (generata dall'editor)

### 2. Apri l'editor in locale
```bash
# Avvia un server locale (necessario per Web Audio API)
npx serve .
# oppure
python3 -m http.server 8080
```
Apri `http://localhost:8080/editor.html`

### 3. Mappa la canzone
1. Carica l'MP3 nell'editor
2. Scegli la difficoltà
3. Usa **🎯 GENERA** per il tracciato automatico, oppure registra a mano
4. Clicca **💾 SALVA JSON** — scarica il file JSON

### 4. Carica i file nel repo
```bash
cp ~/Downloads/nome-canzone.mp3 songs/
cp ~/Downloads/nome-canzone_Normal.json songs/
```

### 5. Aggiorna catalog.json
Aggiungi la voce alla lista (l'editor mostra l'entry pronta da copiare):
```json
{
  "id": "nome-canzone",
  "title": "Nome Canzone",
  "artist": "Artista",
  "bpm": 140,
  "audioUrl": "https://raw.githubusercontent.com/CarmineVarone/rythmjs/main/songs/nome-canzone.mp3",
  "difficulties": [
    {
      "diff": "Normal",
      "mapUrl": "https://raw.githubusercontent.com/CarmineVarone/rythmjs/main/songs/nome-canzone_Normal.json",
      "noteCount": 180
    }
  ]
}
```

### 6. Push su GitHub
```bash
git add .
git commit -m "Aggiunta canzone: Nome Canzone"
git push
```

### 7. Abilita GitHub Pages
- Vai su `github.com/CarmineVarone/rythmjs` → Settings → Pages
- Source: **Deploy from a branch** → branch: **main** → root: **/ (root)**
- Il gioco sarà su `https://carminevarone.github.io/rythmjs/`

## Controlli gioco (desktop)
- **F / G** → DON (centro tamburo)
- **D / H** → KA (bordo tamburo)

## Controlli editor (desktop)
- **F / G** → registra nota DON
- **D / H** → registra nota KA
- **Tieni premuto** → hold note (250ms+)
- **Spazio** → Play/Pause
- **← →** → salta ±2s (Shift = ±0.2s)
- **Rotella** → scroll timeline
- **Click destro** → elimina nota
- **Ctrl+Z** → undo
- **Ctrl+S** → salva JSON
