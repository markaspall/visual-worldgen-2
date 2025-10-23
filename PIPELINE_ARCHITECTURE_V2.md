# 🏗️ Pipeline Architecture V2 - Final Design

**Date**: October 23, 2025  
**Status**: Architecture Locked - Ready for Implementation

---

## 🎯 Core Principles

### **1. 2D First, 3D On-Demand**
- Process everything possible in **2D** (GPU-efficient)
- Sample into **3D** only when generating chunks
- **No 3D volume storage** - just algorithms

### **2. Large-Scale 2D Processing**
- Use **1024×1024** (or larger) 2D maps
- GPU compute shaders for all 2D operations
- Cache results to avoid recomputation

### **3. Multi-Resolution Strategy**
- **High-res base**: 1024×1024 for final quality
- **Downsample for erosion**: 512×512 or 256×256 (faster, still good)
- **Upsample results**: Back to 1024×1024 with detail preservation

### **4. Node-Based + Cacheable**
- Every node caches its output
- Deterministic (same inputs = same output)
- Visual preview at each stage

### **5. Sampling Philosophy**
> "How much can we do just by point sampling?"
- Minimize storage
- Maximize algorithms
- Cache only what's expensive to recompute

---

## 📊 Pipeline Stages

### **Stage 1: Base Terrain (2D, Cached)**

```
Resolution: 1024×1024 (can go higher!)
GPU: Compute shaders
Cache: Float32Array per map

┌─────────────────────────────────────┐
│ 1. Base Elevation                   │
│    [Continental Perlin]             │
│    [Regional Perlin]                │
│    [Local Perlin]                   │
│    → [Blend] → ELEVATION MAP        │
│                                     │
│    Output: elevation.bin (4MB)      │
│    Preview: Grayscale heightmap     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 2. Temperature                      │
│    [Gradient - Latitude]            │
│    [Perlin - Variation]             │
│    → [Blend] → TEMPERATURE MAP      │
│                                     │
│    Output: temperature.bin (4MB)    │
│    Preview: Red (hot) to Blue (cold)│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 3. Moisture (Pre-Erosion)           │
│    [Perlin Noise]                   │
│    → MOISTURE MAP                   │
│                                     │
│    Output: moisture.bin (4MB)       │
│    Preview: Brown (dry) to Blue (wet)│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 4. Pre-Erosion Biomes               │
│    elevation + temperature + moisture│
│    → [BiomeClassifier GPU]          │
│    → BIOME MAP                      │
│                                     │
│    Output: biomes.bin (1MB)         │
│    Preview: Colored biome map       │
└─────────────────────────────────────┘
```

---

### **Stage 2: Erosion (2D, Downsampled)**

```
Resolution: 512×512 (downsampled for speed)
GPU: Particle-based erosion shader
Cache: Erosion results

┌─────────────────────────────────────┐
│ 5. Downsample                       │
│    elevation (1024) → (512)         │
│    moisture (1024) → (512)          │
│    biomes (1024) → (512)            │
│                                     │
│    Method: Bilinear averaging       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 6. Hydraulic Erosion                │
│    Input: elevation_512, moisture_512│
│    Algorithm:                       │
│      - Spawn 50K particles          │
│      - 20 iterations                │
│      - Moisture affects erosion rate│
│      - Deposit sediment in flats    │
│                                     │
│    Output:                          │
│      - eroded_elevation_512.bin     │
│      - sediment_512.bin             │
│                                     │
│    Preview: Eroded heightmap        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 7. Upsample Back                    │
│    eroded_elevation (512) → (1024)  │
│    sediment (512) → (1024)          │
│                                     │
│    Method: Bicubic + detail from    │
│            original high-res noise  │
│                                     │
│    Output:                          │
│      - elevation_final.bin (4MB)    │
│      - sediment_final.bin (4MB)     │
└─────────────────────────────────────┘
```

**Why downsample?**
- ✅ Erosion is **10× faster** at 512×512
- ✅ Still captures major rivers/valleys
- ✅ Upsampling preserves detail
- ✅ User approved ✓

---

### **Stage 3: Water Systems (2D, Cached)**

```
Resolution: 1024×1024
GPU: Flow accumulation shader

┌─────────────────────────────────────┐
│ 8. Surface Water Flow               │
│    Input: elevation_final           │
│    Algorithm:                       │
│      - Calculate slope              │
│      - Flow accumulation            │
│      - Identify rivers (high flow)  │
│      - Identify lakes (local minima)│
│                                     │
│    Output:                          │
│      - flow_accumulation.bin (4MB)  │
│      - rivers.bin (binary mask)     │
│      - lakes.bin (depth map)        │
│                                     │
│    Preview: Blue lines (rivers)     │
│             Blue pools (lakes)      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 9. Underground Water Table          │
│    Input:                           │
│      - elevation_final              │
│      - rivers (recharge zones)      │
│      - perlin noise (variation)     │
│                                     │
│    Algorithm:                       │
│      water_depth = f(elevation,     │
│                      distance_to_river,│
│                      perlin_noise)  │
│                                     │
│    Output: water_table.bin (4MB)    │
│    Preview: Depth to water (blue gradient)│
└─────────────────────────────────────┘
```

---

### **Stage 4: Cave Systems (2D Metadata, 3D Sampling)**

```
Resolution: 1024×1024 (metadata only!)
No 3D storage - sampling algorithm only

┌─────────────────────────────────────┐
│ 10. Cave Opening Likelihood         │
│     Input:                          │
│       - elevation_final (slope)     │
│       - geology (rock type)         │
│       - rivers (water erosion)      │
│                                     │
│     Algorithm:                      │
│       opening_chance = f(slope > 30°,│
│                         near_water, │
│                         elevation)  │
│                                     │
│     Output: cave_openings.bin (1MB) │
│     Preview: Hot spots (red = likely)│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 11. 3D Cave Sampling (On-Demand)    │
│     NOT CACHED - Algorithm only!    │
│                                     │
│     When chunk (x, y, z) requested: │
│                                     │
│     is_cave(x, y, z):               │
│       // Base worm noise            │
│       worm = wormy_perlin_3d(x,y,z) │
│                                     │
│       // Variable width by depth    │
│       depth = elevation(x,z) - y    │
│       width_noise = perlin_3d(x,y,z)│
│       threshold = 0.5 + depth*0.0002│
│                     + width_noise*0.1│
│                                     │
│       // Deeper = bigger caverns    │
│       if (worm > threshold):        │
│         return CAVE                 │
│                                     │
│       // Near opening? More likely  │
│       if (near_opening(x,z)):       │
│         threshold *= 0.8  // easier │
│                                     │
│       return SOLID                  │
│                                     │
│     Preview: N/A (generated per chunk)│
└─────────────────────────────────────┘
```

**Key Innovation:**
- Width varies with **depth + noise**
- Shallow = narrow tunnels
- Deep = wide caverns
- Surface openings from slope analysis

---

### **Stage 5: Block Generation (3D Sampling)**

```
Resolution: Per 32³ chunk
No pre-generation - sample on request

┌─────────────────────────────────────┐
│ 12. 3D Biome Sampling               │
│     For each voxel (x, y, z):       │
│                                     │
│     temp_3d = temp_2d(x,z)          │
│                + depth_modifier(y)  │
│                                     │
│     moisture_3d = moisture_2d(x,z)  │
│                 + cave_humidity     │
│                                     │
│     biome_3d = classify(temp_3d,    │
│                        moisture_3d, │
│                        depth)       │
│                                     │
│     Example:                        │
│       Deep + Hot = Lava biome       │
│       Cave + Wet = Mushroom biome   │
│       Surface + Cold = Snow biome   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 13. Underground Water Filling       │
│     For cave voxels:                │
│                                     │
│     y_voxel = current y position    │
│     water_level = water_table(x,z)  │
│                                     │
│     if (y_voxel < water_level):     │
│       if (is_cave):                 │
│         return WATER (underground pool)│
│       if (near_river && below_river):│
│         return WATER (aquifer)      │
│                                     │
│     Surface check:                  │
│       if (rivers(x,z)):             │
│         return WATER (surface river)│
│       if (lakes(x,z)):              │
│         return WATER (surface lake) │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 14. Block Type Selection            │
│     Input: biome_3d, y, water, cave │
│                                     │
│     if (y > elevation(x,z)):        │
│       return AIR                    │
│                                     │
│     if (is_water):                  │
│       return WATER                  │
│                                     │
│     if (is_cave && !is_water):      │
│       return AIR                    │
│                                     │
│     // Solid block                  │
│     switch(biome_3d):               │
│       case GRASSLAND:               │
│         if (y == surface): GRASS    │
│         if (y > surface-3): DIRT    │
│         else: STONE                 │
│                                     │
│       case DESERT:                  │
│         if (y > surface-5): SAND    │
│         else: SANDSTONE             │
│                                     │
│       case MOUNTAINS:               │
│         return STONE                │
│                                     │
│       case SNOW:                    │
│         if (y == surface): SNOW     │
│         else: STONE                 │
│                                     │
│       // ... more biomes            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 15. SVDAG Compression               │
│     32³ voxel array → Octree → SVDAG│
│     Return compressed to client     │
└─────────────────────────────────────┘
```

---

## 💾 Caching Strategy

### **What Gets Cached (Per Region)**

```
2D Maps (1024×1024):
├─ elevation_final.bin      4 MB
├─ temperature.bin          4 MB
├─ moisture.bin             4 MB
├─ biomes.bin               1 MB
├─ sediment.bin             4 MB
├─ flow_accumulation.bin    4 MB
├─ rivers.bin (mask)        1 MB
├─ lakes.bin                4 MB
├─ water_table.bin          4 MB
├─ cave_openings.bin        1 MB
└─────────────────────────────
   Total: ~31 MB per region
```

**For 10×10 region grid**: ~3.1 GB (manageable!)

### **What NEVER Gets Cached**

```
✗ 3D cave geometry (sample on-demand)
✗ 3D biomes (compute from 2D + depth)
✗ 3D water (compute from water_table)
✗ Block types (compute from biome + position)
✗ Individual chunks (regenerate from maps)
```

**Why?** 1024³ volume = **4 GB per region!** vs 31 MB for 2D maps.

---

## 🎨 Node Outputs & Previews

### **Every Node Provides:**

1. **Data Output**: Float32Array or Uint8Array
2. **Visual Preview**: Canvas/ImageData for UI
3. **Cache Key**: Based on inputs + params
4. **Metadata**: Min/max values, statistics

### **UI Visualization:**

```
[Node Editor]
  ├─ Select node
  ├─ Preview canvas shows output
  ├─ Adjust parameters
  └─ See live updates (if not cached)

[Gallery View]
  Display all intermediate maps:
  ├─ elevation.png
  ├─ temperature.png
  ├─ moisture.png
  ├─ biomes.png
  ├─ eroded.png
  ├─ rivers.png
  └─ caves.png
```

---

## 🚀 Implementation Priority

### **Phase 1: Seamless Terrain** ✅ DONE
- [x] PerlinNoiseNode
- [x] BlendNode
- [x] RemapNode
- [x] Fix seams (offsetX/Z)

### **Phase 2: Basic Biomes** ← NEXT!
- [ ] BiomeClassifierNode (2D GPU shader)
- [ ] BlockClassifierNode (simple rules)
- [ ] Test: See colored biomes in 3D

### **Phase 3: Water Systems**
- [ ] WaterFlowNode (flow accumulation)
- [ ] RiverDetectorNode (threshold flow)
- [ ] LakeDetectorNode (local minima)
- [ ] WaterTableNode (underground water)
- [ ] Test: Rivers and lakes render

### **Phase 4: Erosion**
- [ ] DownsampleNode (1024 → 512)
- [ ] HydraulicErosionNode (particle GPU)
- [ ] UpsampleNode (512 → 1024 + detail)
- [ ] Test: Realistic valleys and mountains

### **Phase 5: Caves**
- [ ] CaveOpeningNode (slope analysis)
- [ ] 3D Cave Sampling (in chunk generator)
- [ ] Variable width algorithm
- [ ] Test: Caves open naturally, big caverns deep

### **Phase 6: Advanced Features** (Later)
- [ ] Plate tectonics
- [ ] Lava chambers
- [ ] Feature detection
- [ ] Trail generation

---

## 📐 Resolution Decisions

### **Confirmed Choices:**

| Aspect | Resolution | Rationale |
|--------|-----------|-----------|
| **Base 2D maps** | 1024×1024 | High quality, GPU can handle it |
| **Erosion processing** | 512×512 | ✅ **Downsample approved** - 10× faster |
| **Final 2D maps** | 1024×1024 | Upsample back with detail |
| **Chunk size** | 32³ voxels | Industry standard |
| **Region size** | 16×16 chunks = 512×512 voxels | Good balance |

---

## 🌊 Water Systems Design

### **Surface Water:**
- Rivers: High flow accumulation paths
- Lakes: Filled local minima
- Render: Blue material, reflective

### **Underground Water:**
```
water_table_depth(x, z) = 
  base_depth (from elevation)
  - distance_bonus (near rivers)
  + noise_variation (realism)

Cave flooding:
  if (cave_y < water_table_depth):
    fill with WATER
```

**Result:** Natural aquifers, underground rivers, flooded caves near surface water!

---

## 🕳️ Cave Width Algorithm

```javascript
// Wormy Perlin 3D for cave tunnels
const worm_value = wormy_perlin_3d(x, y, z, {
  frequency: 0.02,
  octaves: 2
});

// Depth below surface
const depth = elevation_2d(x, z) - y;

// Width modulation
const width_noise = perlin_3d(x, y, z, {
  frequency: 0.05
});

// Threshold calculation
let threshold = 0.5;              // Base (thin tunnels)
threshold += depth * 0.0002;      // ✅ Deeper = wider
threshold += width_noise * 0.1;   // ✅ Noise varies width

// Is this voxel a cave?
const is_cave = worm_value > threshold;
```

**Effect:**
- Shallow (y=240): threshold ≈ 0.52 → **narrow tunnels**
- Medium (y=180): threshold ≈ 0.62 → **wider passages**
- Deep (y=60):    threshold ≈ 0.86 → **massive caverns**

**Plus noise creates**:
- Occasional wide chambers
- Natural pinch points
- Organic variation

---

## ✅ Locked Decisions

1. ✅ **2D-first architecture** - Process in 2D, sample to 3D
2. ✅ **Large 2D maps** - 1024×1024 or larger
3. ✅ **Downsample erosion** - 512×512 is fine
4. ✅ **Variable cave width** - Depth + noise modulation
5. ✅ **Surface + underground water** - Flow accumulation + water table
6. ✅ **Node caching** - Every node caches output
7. ⏳ **Features later** - Postpone to Phase 6

---

## 🎯 Next Immediate Action

**Build BiomeClassifierNode + BlockClassifierNode**

This will let us:
- ✅ See colored biome maps in 2D
- ✅ Get proper block types in 3D
- ✅ Validate the full 2D → 3D pipeline

**Then we have a solid foundation for erosion, water, and caves!**

---

**Architecture is locked. Ready to build!** 🚀
