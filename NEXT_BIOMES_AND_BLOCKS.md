# 🎯 Next Phase: Biomes & Blocks

## ✅ Monitor Status - FIXED!

### **Issues Fixed:**
1. ✅ **Table columns** - No more hardcoded EROSION, UPSCALE columns
2. ✅ **Dynamic headers** - Shows "Nodes" column (future: actual node breakdown)
3. ✅ **Function signature** - Fixed `updateCharts` missing nodeStats parameter

### **To See PerlinNoise Now:**
**Click the ▶ arrow** next to "🧱 Primitive Nodes (Building Blocks)" in the monitor!

You'll see:
```
PerlinNoise: 12.3ms avg | 156 exec, 89.7% cached
freq: 0.0010, octaves: 4, persistence: 0.5
```

---

## 🏗️ Architecture Plan: Biomes & Blocks FIRST!

You're absolutely right to prioritize this order:

### **Phase 1: Basic Terrain** ✅ DONE
```
PerlinNoise → Heightmap
```

### **Phase 2: Classification** ← WE ARE HERE
```
Heightmap + Moisture + Temperature + Water
    ↓
BiomeClassifier (PROCESSOR)
    ↓
Biome IDs (0-12: Ocean, Desert, Forest, etc.)
    ↓
BlockClassifier (PROCESSOR)
    ↓
Block Types (Grass, Sand, Stone, Snow, etc.)
```

### **Phase 3: Enhancement** (Later)
```
Classified Terrain
    ↓
HydraulicErosion (optional realism)
    ↓
Features (trees, structures)
    ↓
Final World
```

**Why this order is smart:**
- ✅ Get biomes working first (essential)
- ✅ Get blocks assigned (essential)
- ✅ THEN add polish (erosion, features)

---

## 📊 What BiomeClassifier Does

### **Inputs:**
- `height` - Elevation map [0-1]
- `moisture` - Moisture map [0-1] (from Perlin)
- `temperature` - Temperature map [0-1] (from gradient + Perlin)
- `water` - Water presence [0-1]

### **Logic: "Most Specific Wins"**

**Example biome rules:**
```javascript
{
  name: 'Desert',
  height: [0.45, 1.0],    // Above sea level
  moisture: [0, 0.25],    // DRY
  temperature: [0.6, 1.0], // HOT
  water: [0, 0]           // No water
}

{
  name: 'Tropical Forest',
  height: [0.45, 0.7],     // Low elevation
  moisture: [0.6, 1.0],    // WET
  temperature: [0.7, 1.0], // HOT
  water: [0, 0]            // No water
}
```

**Classification:**
- Pixel with (height=0.6, moisture=0.1, temp=0.8, water=0) → **Desert** ✅
- Pixel with (height=0.5, moisture=0.9, temp=0.9, water=0) → **Tropical Forest** ✅

### **Outputs:**
- `biomeIds` - Uint8Array of biome IDs (0-12)
- `colorMap` - Visualization (colored biome map)
- `biomeList` - Metadata for BlockClassifier

---

## 🧊 What BlockClassifier Does

### **Inputs:**
- `biomes` - Biome IDs from BiomeClassifier
- `water` - Water presence
- `height` - Elevation
- `noise1` - Random variation noise
- `biomeList` - Biome metadata

### **Logic: Biome → Blocks Mapping**

**Example rules:**
```javascript
{
  biomeId: 5, // Grassland
  blocks: [
    { blockId: 1, blockName: 'Grass', weight: 1.0 }
  ],
  waterBlocks: [
    { blockId: 6, blockName: 'Water', weight: 1.0 }
  ]
}

{
  biomeId: 6, // Tropical Forest
  blocks: [
    { blockId: 1, blockName: 'Grass', weight: 0.8 },
    { blockId: 7, blockName: 'Tree Seed', weight: 0.2 } // 20% trees!
  ]
}
```

**Process:**
1. Look up biome ID for pixel
2. Get block rules for that biome
3. Use weighted random (with noise1) to pick block
4. Output terrain block ID and water block ID

### **Outputs:**
- `terrainBlocks` - Uint8Array of block IDs
- `waterBlocks` - Uint8Array of water block IDs  
- `blockMapVis` - Visualization

---

## 🚧 What Needs to be Done

### **1. Port BiomeClassifierNode** (Processor)
**Complexity:** Medium
- Uses WebGPU compute shader
- Already have shader code (`biomeClassifier.wgsl`)
- Need to adapt to unified node system
- **Category:** Processor (shows in main monitor section)

**Key changes:**
- Inherit from new `BaseNode`
- Add to unified `NodeRegistry`
- Update `static params` format
- Ensure isomorphic (works browser + server)

### **2. Port BlockClassifierNode** (Processor)
**Complexity:** Medium-High
- Uses WebGPU compute shader
- More complex data structures (block types, biome rules)
- Already have shader code (`blockClassifier.wgsl`)
- **Category:** Processor (shows in main monitor section)

**Key changes:**
- Same as BiomeClassifier
- Handle complex parameter UI (blocks table, rules table)
- Link to biome list output

### **3. Create Supporting Primitives**
Before classifiers work, we need input data:

#### **A. GradientNode** (Primitive)
- Generates latitude-based gradient
- Input: none (just uses y-coordinate)
- Output: gradient map
- **Use:** Temperature baseline

#### **B. SimplexNoiseNode** (Primitive) - Optional but Better
- Better quality than Perlin
- Less directional artifacts
- **Use:** Moisture, temperature variation

#### **C. ConstantNode** (Primitive)
- Outputs constant value
- **Use:** Water map (all 0 initially)

### **4. Create Example Pipeline**

```
┌─────────────────┐
│ PerlinNoise     │ → Height
│ (continental)   │
└─────────────────┘

┌─────────────────┐
│ SimplexNoise    │ → Moisture
│ (moisture)      │
└─────────────────┘

┌─────────────────┐
│ GradientNode    │ → Temperature (base)
│ (latitude)      │
└─────────────────┘

┌─────────────────┐
│ SimplexNoise    │ → Temperature (variation)
│ (temp noise)    │
└─────────────────┘

┌─────────────────┐
│ BlendNode       │ → Temperature (final)
│ (add gradient   │
│  + noise)       │
└─────────────────┘

┌─────────────────┐
│ ConstantNode    │ → Water (all 0)
│ (no water yet)  │
└─────────────────┘

        ↓
        
┌─────────────────────────────┐
│ BiomeClassifier PROCESSOR   │
│ Inputs: height, moisture,   │
│         temp, water          │
│ Output: biome IDs            │
└─────────────────────────────┘

        ↓
        
┌─────────────────────────────┐
│ BlockClassifier PROCESSOR   │
│ Inputs: biomes, water,      │
│         height, noise        │
│ Output: terrain blocks       │
└─────────────────────────────┘

        ↓
        
    FINAL WORLD!
```

---

## 📋 Recommended Implementation Order

### **Week 1: Supporting Primitives**
1. **GradientNode** (~30 lines, simple)
2. **SimplexNoiseNode** (~60 lines, noise math)
3. **BlendNode** (~40 lines, combines inputs)
4. **ConstantNode** (~20 lines, trivial)

### **Week 2: Biome Classification**
1. **Port BiomeClassifierNode** (processor)
2. **Test**: Height + Moisture + Temp → Biome colors
3. **Verify** in monitor: BiomeClassifier appears in Processor section

### **Week 3: Block Classification**
1. **Port BlockClassifierNode** (processor)
2. **Test**: Biomes → Block types
3. **Verify** in 3D viewer: Grass, sand, snow, etc.

### **Week 4: Polish**
1. **Parameter UI** for biome/block tables
2. **Default pipeline template**
3. **Documentation**

---

## 🎯 Success Criteria

**You'll know it's working when:**

✅ Monitor shows:
```
🔧 PROCESSOR NODES
├─ BiomeClassifier: 8ms avg | 12 exec, 100% cached
└─ BlockClassifier: 12ms avg | 12 exec, 95% cached

🧱 PRIMITIVE NODES ▼
├─ PerlinNoise: 12ms | 156 exec
├─ SimplexNoise: 10ms | 156 exec
├─ GradientNode: 1ms | 12 exec
├─ BlendNode: 2ms | 24 exec
└─ ConstantNode: 0ms | 12 exec (always cached!)
```

✅ 3D Viewer shows:
- Oceans (blue water)
- Beaches (sand)
- Deserts (sand)
- Grasslands (grass)
- Forests (grass + trees)
- Mountains (stone/snow)

✅ Pipeline JSON has:
- Multiple Perlin/Simplex nodes
- BiomeClassifier processor
- BlockClassifier processor
- All connected properly

---

## 🚀 Next Steps

**Ready to start?**

**Option A:** Build primitives first (GradientNode, SimplexNoise, Blend, Constant)
**Option B:** Jump straight to BiomeClassifier (requires manual mock data for testing)

**Recommendation:** **Option A** - Build primitives first!
- Gives us more building blocks
- Can test each one independently
- BiomeClassifier needs them anyway

**Start with GradientNode** - simplest processor input, only ~30 lines!

---

**Once this is all done, THEN we add erosion and fancy features!** 🎉
