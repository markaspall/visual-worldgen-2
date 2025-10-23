# Storage Directory Structure

This directory contains persistent data for the Visual World Generator.

## 📁 Directory Layout

```
storage/
├── worlds/              # World definitions (COMMITTED to git)
│   └── {worldId}/
│       ├── config.json       # World config (seed, name, etc)
│       └── pipeline.json     # Terrain generation graph (node-based)
│
├── graphs/              # Saved UI graphs (COMMITTED to git)
│   └── {graphId}.json   # Reusable pipeline templates
│
├── cache/               # Runtime cache (IGNORED by git)
│   └── regions/         # Cached region heightmaps
│
└── chunks/              # Chunk cache (IGNORED by git)
    └── {worldId}/       # Pre-generated SVDAG chunks
```

## 🌍 World Files

### **config.json**
Basic world metadata:
```json
{
  "seed": 12345,
  "name": "Test World",
  "created": "2025-10-23T12:00:00Z"
}
```

### **pipeline.json**
Complete terrain generation pipeline:
```json
{
  "nodes": [
    {
      "id": "node_0",
      "type": "PerlinNoise",
      "params": { "frequency": 0.001, "octaves": 4 }
    }
  ],
  "connections": [],
  "metadata": {}
}
```

**This is the source of truth for how the world generates!**

## 📊 Graph Files

Reusable pipeline templates saved from the UI. Can be loaded into any world.

Same format as `pipeline.json` but not tied to a specific world.

## 🗂️ Cache Directories

Runtime caches that speed up generation. Safe to delete - will regenerate.

### **cache/regions/**
Stores computed region data (512×512 heightmaps) to avoid re-running nodes.

### **chunks/{worldId}/**
Pre-generated SVDAG chunks stored on disk for persistence across server restarts.

---

## 🎯 What to Commit

✅ **Commit these:**
- `worlds/` - World definitions
- `graphs/` - Reusable templates
- `README.md` (this file)

❌ **Don't commit these:**
- `cache/` - Runtime cache
- `chunks/` - Generated data

---

## 🔄 Workflow

1. **Design** in UI → Save graph to `graphs/`
2. **Create World** → Save pipeline to `worlds/{worldId}/pipeline.json`
3. **Generate** → Server executes pipeline, caches to `cache/`
4. **Play** → Client fetches chunks, server caches to `chunks/`

**Result:** Worlds are reproducible (same pipeline = same world), but caches are regenerated as needed.
