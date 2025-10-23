# Visual World Generator v2.0

**Clean, unified node-based procedural terrain generation system**

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Open browser
# - Node Graph UI: http://localhost:3012/
# - Performance Monitor: http://localhost:3012/monitor
# - Infinite World Viewer: http://localhost:3012/worlds/test_world/infinite
```

## Architecture

```
User designs pipeline in UI
        |
        v
Saves graph to storage/worlds/{worldId}/pipeline.json
        |
        v
Server loads graph and executes with GraphExecutor
        |
        v
Nodes generate terrain data (heightmap, biomes, etc.)
        |
        v
ChunkGenerator converts to voxels (32x32x32)
        |
        v
SVDAGBuilder compresses to SVDAG
        |
        v
Client renders with raymarcher shader
```

## Project Structure

```
visual-world-gen-v2/
â”œâ”€â”€ server.js                          # Main Express server
â”œâ”€â”€ package.json                       # Dependencies
â”‚
â”œâ”€â”€ server/
â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”œâ”€â”€ chunksv2.js               # V2 chunk generation API
â”‚   â”‚   â””â”€â”€ monitor.js                 # Performance monitoring
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â””â”€â”€ svdagBuilder.js            # SVDAG compression
â”‚   â””â”€â”€ lib/
â”‚       â””â”€â”€ nodesv2/                   # (Will migrate to shared/)
â”‚
â”œâ”€â”€ shared/                            # (To be created)
â”‚   â”œâ”€â”€ nodes/
â”‚   â”‚   â”œâ”€â”€ BaseNode.js
â”‚   â”‚   â”œâ”€â”€ primitives/
â”‚   â”‚   â””â”€â”€ processors/
â”‚   â”œâ”€â”€ templates/
â”‚   â”œâ”€â”€ NodeRegistry.js
â”‚   â”œâ”€â”€ GraphExecutor.js
â”‚   â””â”€â”€ GPUContext.js
â”‚
â”œâ”€â”€ views/
â”‚   â”œâ”€â”€ index.ejs                      # Node graph UI
â”‚   â”œâ”€â”€ monitor.ejs                    # Performance monitor
â”‚   â””â”€â”€ worldInfinite.ejs              # Infinite world viewer
â”‚
â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ js/
â”‚   â”‚   â”œâ”€â”€ main.js                    # UI main entry
â”‚   â”‚   â”œâ”€â”€ nodeEditor.js              # Visual node editor
â”‚   â”‚   â”œâ”€â”€ chunkedSvdagRenderer.js    # WebGPU renderer
â”‚   â”‚   â”œâ”€â”€ chunkManager.js            # Chunk loading
â”‚   â”‚   â”œâ”€â”€ monitor.js                 # Monitor dashboard
â”‚   â”‚   â””â”€â”€ webgpu.js                  # WebGPU helpers
â”‚   â”œâ”€â”€ shaders/
â”‚   â”‚   â””â”€â”€ raymarcher_svdag_chunked.wgsl  # Main shader
â”‚   â””â”€â”€ css/
â”‚       â”œâ”€â”€ style.css
â”‚       â””â”€â”€ monitor.css
â”‚
â””â”€â”€ storage/
    â”œâ”€â”€ worlds/                        # Per-world data
    â”‚   â””â”€â”€ {worldId}/
    â”‚       â””â”€â”€ pipeline.json          # Terrain generation graph
    â””â”€â”€ graphs/                        # Saved UI graphs
```

## Current Status

**Phase 1: Infrastructure** (In Progress)
- [x] Server setup
- [x] V2 chunk generation
- [x] Performance monitoring
- [x] SVDAG compression
- [x] WebGPU rendering
- [ ] Shared node system
- [ ] PerlinNoiseNode (first primitive)
- [ ] GraphExecutor
- [ ] End-to-end test

## Documentation

See UNIFIED_NODE_SYSTEM_PROPOSAL.md for full architecture details.

## Development

```bash
# Start with auto-reload
npm run dev

# View monitor
# http://localhost:3012/monitor

# Test GPU
npm run test:gpu
```

## License

MIT
