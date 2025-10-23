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
  server.js                          # Main Express server
  package.json                       # Dependencies
  
  server/
    routes/
      chunksv2.js                    # V2 chunk generation API
      monitor.js                     # Performance monitoring
    services/
      svdagBuilder.js                # SVDAG compression
    lib/
      nodesv2/                       # (Will migrate to shared/)
  
  shared/                            # Unified node system
    nodes/
      BaseNode.js                    # Base class
      primitives/                    # Generic building blocks
        PerlinNoiseNode.js           # First primitive!
      processors/                    # Specialized algorithms
    templates/                       # Composable subgraphs
    NodeRegistry.js                  # Node registration
    GraphExecutor.js                 # Execute graphs server-side
  
  views/
    index.ejs                        # Node graph UI
    monitor.ejs                      # Performance monitor
    worldInfinite.ejs                # Infinite world viewer
  
  public/
    js/
      main.js                        # UI main entry
      nodeEditor.js                  # Visual node editor
      chunkedSvdagRenderer.js        # WebGPU renderer
      chunkManager.js                # Chunk loading
      monitor.js                     # Monitor dashboard
      webgpu.js                      # WebGPU helpers
    shaders/
      raymarcher_svdag_chunked.wgsl  # Main shader
    css/
      style.css
      monitor.css
  
  storage/
    worlds/                          # Per-world data
      {worldId}/
        config.json                  # World config (seed, etc)
        pipeline.json                # Terrain generation graph
    graphs/                          # Saved UI graphs
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
