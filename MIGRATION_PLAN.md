# Migration Plan: Clean New Repository

## 🎯 Goal
Create a fresh repository with ONLY what's needed for the unified node system.

**End-to-End Test:** UI → Design Base Noise → See it rendered in shader

---

## 📁 Files to Copy

### **Core Server Files**
```
✅ server.js                                # Main entry point
✅ package.json                             # Dependencies
✅ .gitignore                               # Git ignore patterns (if exists)
```

### **Server Routes**
```
✅ server/routes/chunksv2.js               # V2 chunk generation API
✅ server/routes/monitor.js                 # Performance monitoring API
```

### **Server Services**
```
✅ server/services/svdagBuilder.js          # SVDAG compression
❌ server/services/graphExecutor.js         # OLD - will be replaced with shared/GraphExecutor.js
❌ server/services/graphExecutionEngine.js  # OLD - not needed
❌ server/services/streamChunkGenerator.js  # OLD - not needed
❌ server/services/superChunkGenerator.js   # OLD - not needed
```

### **Server Nodes (will migrate to shared/)**
```
⚠️ server/lib/nodesv2/BaseElevationNode.js  # Will refactor to primitives
⚠️ server/lib/nodesv2/HydraulicErosionNode.js # Keep as processor
⚠️ server/lib/nodesv2/UpscaleNode.js         # Keep as processor
❌ server/lib/nodesv2/PreErosionMoistureNode.js  # Delete - use PerlinNoise primitive
❌ server/lib/nodesv2/PostErosionMoistureNode.js # Delete - use PerlinNoise primitive
❌ server/lib/nodesv2/ChunkGeneratorNode.js  # Will rewrite
```

### **Views (EJS Templates)**
```
✅ views/index.ejs                          # Node graph UI
✅ views/monitor.ejs                        # Performance monitor
✅ views/worldInfinite.ejs                  # Infinite world viewer
❌ views/world.ejs                          # OLD viewer - not needed
❌ views/worldMesh.ejs                      # OLD mesh viewer - not needed
❌ views/worldSvdag.ejs                     # OLD SVDAG viewer - not needed
```

### **Client JavaScript**
```
✅ public/js/main.js                        # Node graph editor main
✅ public/js/nodeEditor.js                  # Visual node editor
✅ public/js/chunkedSvdagRenderer.js        # Infinite world renderer
✅ public/js/chunkManager.js                # Chunk loading/unloading
✅ public/js/monitor.js                     # Monitor dashboard JS
✅ public/js/webgpu.js                      # WebGPU helper
❌ public/js/pipeline.js                    # OLD - will rewrite
❌ public/js/visualizer.js                  # OLD - not needed
❌ public/js/worldRenderer.js               # OLD - not needed
❌ public/js/svdagRenderer.js               # OLD - not needed
❌ public/js/meshRenderer.js                # OLD - not needed
❌ public/js/meshBuilder.js                 # OLD - not needed
❌ public/js/visibilityScanner.js           # OLD - not needed
```

### **Client Nodes (OLD - most will be deleted)**
```
❌ public/js/nodes/*                        # All old nodes - will rebuild as shared/nodes
```

### **Shaders**
```
✅ public/shaders/raymarcher_svdag_chunked.wgsl  # Main rendering shader
❌ public/shaders/raymarcher_svdag.wgsl          # OLD
❌ public/shaders/raymarcher.wgsl                # OLD
❌ public/shaders/mesh_terrain.wgsl              # OLD
❌ public/shaders/biomeClassifier.wgsl           # OLD
❌ public/shaders/blockClassifier.wgsl           # OLD
❌ public/shaders/gradient.wgsl                  # OLD
❌ public/shaders/heightLOD.wgsl                 # OLD
❌ public/shaders/temperature.wgsl               # OLD
❌ public/shaders/blit.wgsl                      # OLD
❌ public/shaders/shadow_map.wgsl                # OLD
❌ public/shaders/visibility_scan.wgsl           # OLD
```

### **CSS**
```
✅ public/css/style.css                     # Main styles
✅ public/css/monitor.css                   # Monitor styles
```

### **Storage (will be empty in new repo)**
```
✅ storage/                                 # Empty directory (create)
✅ storage/worlds/                          # Empty directory (create)
```

---

## 📋 Summary

### **Keep (23 files)**
1. server.js
2. package.json
3. server/routes/chunksv2.js
4. server/routes/monitor.js
5. server/services/svdagBuilder.js
6. views/index.ejs
7. views/monitor.ejs
8. views/worldInfinite.ejs
9. public/js/main.js
10. public/js/nodeEditor.js
11. public/js/chunkedSvdagRenderer.js
12. public/js/chunkManager.js
13. public/js/monitor.js
14. public/js/webgpu.js
15. public/shaders/raymarcher_svdag_chunked.wgsl
16. public/css/style.css
17. public/css/monitor.css

**Plus these for migration (will refactor):**
18. server/lib/nodesv2/BaseElevationNode.js (→ refactor to primitives)
19. server/lib/nodesv2/HydraulicErosionNode.js (→ keep as processor)
20. server/lib/nodesv2/UpscaleNode.js (→ keep as processor)

### **Delete (50+ files)**
- All old node implementations (client + server)
- Old viewers (mesh, svdag, basic world)
- Old shaders (12+ files)
- Unused services (graphExecutor, streamChunkGenerator, etc.)

---

## 🆕 New Files to Create

In the new repo, we'll create:

```
shared/
├── nodes/
│   ├── BaseNode.js                         # NEW - base class
│   ├── primitives/
│   │   └── PerlinNoiseNode.js             # NEW - first primitive
│   └── processors/
│       ├── HydraulicErosionNode.js        # MIGRATED from server/lib/nodesv2
│       └── UpscaleNode.js                 # MIGRATED from server/lib/nodesv2
├── templates/
│   └── BaseElevationTemplate.js           # NEW - 3 Perlin + Blend
├── NodeRegistry.js                         # NEW - node registration
├── GraphExecutor.js                        # NEW - execute graphs server-side
└── GPUContext.js                           # NEW - abstract GPU interface
```

---

## 🧪 End-to-End Test Plan

### **Test 1: Base Infrastructure**
1. Start server: `npm start`
2. Open `http://localhost:3012/`
3. Verify UI loads
4. Verify monitor loads: `http://localhost:3012/monitor`

### **Test 2: Node Graph UI**
1. Add `PerlinNoiseNode` to canvas
2. Set frequency: 0.001
3. Connect to output
4. Save graph

### **Test 3: Server-Side Generation**
1. Load world: `http://localhost:3012/worlds/test_world/infinite`
2. Verify chunks generate using saved graph
3. See Perlin noise terrain in viewer
4. Check monitor shows node execution times

### **Success Criteria:**
- ✅ UI loads and is responsive
- ✅ Can add PerlinNoise node
- ✅ Can save graph
- ✅ Server uses graph for generation
- ✅ See Perlin terrain in 3D viewer
- ✅ Monitor shows PerlinNoise execution stats

---

## 🔄 Migration Steps

1. **Create new repo** (or clean directory)
2. **Run PowerShell copy script** (see copy_to_new_repo.ps1)
3. **Create shared/ directory structure**
4. **Port BaseElevationNode logic to PerlinNoiseNode**
5. **Create NodeRegistry and GraphExecutor**
6. **Update chunksv2.js to use GraphExecutor**
7. **Update UI to show PerlinNoise in palette**
8. **Test end-to-end**

---

## 📝 Notes

### **World ID Handling**
Currently "real_world" is hardcoded. In the new system:
- World ID comes from URL: `/worlds/{worldId}/infinite`
- Graph saved per world: `storage/worlds/{worldId}/pipeline.json`
- Each world has its own terrain generation pipeline

### **Node System Evolution**
- **Phase 1**: Just PerlinNoise (test infrastructure)
- **Phase 2**: Add Blend, Remap (composability)
- **Phase 3**: Add HydraulicErosion, Upscale (processors)
- **Phase 4**: Full node palette

### **Shader Changes**
The `raymarcher_svdag_chunked.wgsl` should work as-is. No changes needed for Phase 1.

---

**Next:** Run `copy_to_new_repo.ps1` to perform the migration! 🚀
