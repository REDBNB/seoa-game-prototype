// Keep the v1 key and payload compatible with existing browser saves.
const SAVE_KEY = 'seoa-rift-loop-v1';

class LocalSaveService {
  load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch { return null; }
  }
  save(state) { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  clear() { localStorage.removeItem(SAVE_KEY); }
}
