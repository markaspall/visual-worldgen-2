# Unified Node System Proposal

## 🎯 Problem Statement

**The Vision:**
Design terrain generation pipelines visually in a node graph UI, save them, and have the V2 pipeline use those exact same graphs for real-time chunk generation.

**Current Reality:**
- **Node/Graph UI** (client-side): 28 node types for visual design, runs in browser
- **V2 Pipeline** (server-side): 6 hardcoded nodes, runs on server GPU
- **The Disconnect**: These are completely separate systems with no communication

**Result**: V2 pipeline is "drifting away" - you can't design in the UI and have it run in V2.

---

## 🏗️ Proposed Architecture

### Core Concept: **Isomorphic Nodes**

Create nodes that work **BOTH** in the UI (client-side) **AND** in the V2 pipeline (server-side).

```
┌─────────────────────────────────────────────────────┐
│            SHARED NODE DEFINITIONS                   │
│  (Works in browser AND on server)                    │
│                                                       │
│  PRIMITIVES (Generic building blocks):               │
│  • PerlinNoiseNode                                   │
│  • BlendNode                                         │
│  • RemapNode                                         │
│  • NormalizeNode                                     │
│                                                       │
│  DOMAIN PROCESSORS (Specialized algorithms):        │
│  • HydraulicErosionNode                              │
│  • BiomeClassifierNode                               │
│  • ChunkGeneratorNode                                │
│                                                       │
│  TEMPLATES (Composable subgraphs):                  │
│  • BaseElevation (uses 3 Perlin + 2 Blend)          │
│  • Temperature (uses Perlin + Gradient + Blend)     │
└─────────────────────────────────────────────────────┘
           ↓                           ↓
    ┌─────────────┐            ┌──────────────┐
    │  UI Context │            │ V2 Context   │
    │  (Browser)  │            │ (Server GPU) │
    │             │            │              │
    │  • Design   │            │  • Generate  │
    │  • Preview  │            │  • Cache     │
    │  • Save     │            │  • Serve     │
    └─────────────┘            └──────────────┘
```

### Two Node Categories

**1. Primitive Nodes** - Generic, reusable building blocks
   - Just noise generators, math operators, utilities
   - No domain-specific logic
   - **Example**: `PerlinNoiseNode` doesn't know about terrain - it just makes noise

**2. Domain Processor Nodes** - Specialized terrain algorithms
   - Implement actual algorithms (erosion, classification)
   - Can't be simplified further
   - **Example**: `HydraulicErosionNode` implements particle-based erosion

**Key Insight**: Instead of `BaseElevationNode`, `TemperatureNode`, `MoistureNode` (all just Perlin variants), use **one** `PerlinNoiseNode` and compose it differently!

---

## 📋 Implementation Plan

### Phase 1: Create Unified Node Registry (Week 1)

#### 1.1 Create Shared Node Definitions

**Location**: `shared/nodes/` (new directory)

Each node has a single definition file that works in BOTH contexts:

**Example Primitive Node:**

```javascript
// shared/nodes/primitives/PerlinNoiseNode.js
export class PerlinNoiseNode extends BaseNode {
  static type = 'PerlinNoise';
  static category = 'Primitives';
  static inputs = ['seed'];
  static outputs = ['noise'];
  static defaultParams = {
    frequency: 0.001,
    octaves: 3,
    persistence: 0.5,
    lacunarity: 2.0,
    amplitude: 1.0,
    offsetX: 0,
    offsetZ: 0
  };

  constructor(context) {
    super(context); // { gpu, isServer }
  }

  async process(inputs, params) {
    const resolution = params.resolution || 128;
    const buffer = this.createDataBuffer(resolution * resolution * 4);
    
    await this.executeShader(PERLIN_SHADER, [buffer], {
      ...params,
      seed: inputs.seed || params.seed,
      resolution
    }, Math.ceil(resolution / 8));
    
    return {
      noise: await this.downloadData(buffer, resolution)
    };
  }
  
  // UI-specific metadata (ignored on server)
  static uiMetadata = {
    color: '#4a9eff',
    icon: '🌊',
    description: 'Classic Perlin noise - configurable octaves and frequency',
    paramRanges: {
      frequency: { min: 0.0001, max: 0.1, step: 0.0001 },
      octaves: { min: 1, max: 8, step: 1 },
      persistence: { min: 0, max: 1, step: 0.01 }
    }
  };
}
```

**Example Domain Processor Node:**

```javascript
// shared/nodes/processors/HydraulicErosionNode.js
export class HydraulicErosionNode extends BaseNode {
  static type = 'HydraulicErosion';
  static category = 'Processors';
  static inputs = ['elevation', 'moisture'];
  static outputs = ['elevation'];  // Modifies in-place
  static defaultParams = {
    iterations: 10,
    particlesPerIteration: 10000,
    erosionRate: 0.3,
    depositionRate: 0.3,
    evaporationRate: 0.95
  };

  async process(inputs, params) {
    // Complex algorithm - can't be reduced to primitives
    // ... particle simulation code ...
    return { elevation: erodedHeightmap };
  }
  
  static uiMetadata = {
    color: '#ff6b6b',
    icon: '💧',
    description: 'Simulates water erosion using GPU particles',
    expensive: true  // Warn user this is slow
  };
}
```

**Key Points:**
- One file per node type
- Same `process()` method works everywhere
- Context-aware (knows if it's running in browser or server)
- UI metadata is optional (ignored on server)
- **Primitives are tiny** (~40 lines), **Processors are specialized** (~150+ lines)

#### 1.2 Node Categories

Organize nodes into logical categories:

```
shared/
├── nodes/
│   ├── BaseNode.js              # Base class for all nodes
│   │
│   ├── primitives/              # Generic building blocks
│   │   ├── PerlinNoiseNode.js
│   │   ├── SimplexNoiseNode.js
│   │   ├── VoronoiNode.js
│   │   ├── LatitudeGradientNode.js
│   │   ├── ConstantNode.js
│   │   ├── BlendNode.js
│   │   ├── RemapNode.js
│   │   ├── NormalizeNode.js
│   │   ├── PowerNode.js
│   │   └── MaskNode.js
│   │
│   └── processors/              # Domain-specific algorithms
│       ├── HydraulicErosionNode.js
│       ├── ThermalErosionNode.js
│       ├── UpscaleNode.js
│       ├── BiomeClassifierNode.js
│       ├── BlockClassifierNode.js
│       ├── ChunkGeneratorNode.js
│       ├── CaveGeneratorNode.js
│       └── RiverFlowNode.js
│
├── templates/                   # Composable subgraphs
│   ├── BaseElevationTemplate.js     # 3× Perlin + Blend
│   ├── TemperatureTemplate.js       # Gradient + Perlin + Blend
│   ├── MoistureTemplate.js          # Just Perlin (reusable)
│   └── DefaultPipelineTemplate.js   # Complete working pipeline
│
├── NodeRegistry.js              # Node registration system
├── GraphExecutor.js             # Execute graphs server-side
└── GPUContext.js                # Abstract GPU interface
```

**Key Improvement**: Only **~18 nodes** total (10 primitives + 8 processors) instead of 30+ hardcoded variants!

#### 1.3 Node Registry

**File**: `shared/NodeRegistry.js`

```javascript
export class NodeRegistry {
  constructor() {
    this.nodes = new Map();
  }

  register(nodeClass) {
    this.nodes.set(nodeClass.type, nodeClass);
  }

  get(type) {
    return this.nodes.get(type);
  }

  getByCategory(category) {
    return Array.from(this.nodes.values())
      .filter(n => n.category === category);
  }

  getAllTypes() {
    return Array.from(this.nodes.keys());
  }
}

// Auto-register all nodes
export const registry = new NodeRegistry();

// Import and register primitives
import { PerlinNoiseNode } from './nodes/primitives/PerlinNoiseNode.js';
import { BlendNode } from './nodes/primitives/BlendNode.js';
import { RemapNode } from './nodes/primitives/RemapNode.js';
// ... etc

// Import and register processors
import { HydraulicErosionNode } from './nodes/processors/HydraulicErosionNode.js';
import { BiomeClassifierNode } from './nodes/processors/BiomeClassifierNode.js';
// ... etc

// Register all
registry.register(PerlinNoiseNode);
registry.register(BlendNode);
registry.register(HydraulicErosionNode);
// ... etc
```

#### 1.4 Templates (Composable Subgraphs)

Templates let you define commonly-used node combinations:

```javascript
// shared/templates/BaseElevationTemplate.js
export function createBaseElevationTemplate() {
  return {
    name: 'Base Elevation',
    description: 'Multi-scale Perlin noise (continental + regional + local)',
    nodes: [
      {
        id: 'continental',
        type: 'PerlinNoise',
        params: { 
          frequency: 0.0005, 
          octaves: 1, 
          amplitude: 0.6 
        },
        ui: { x: 0, y: 0 }
      },
      {
        id: 'regional',
        type: 'PerlinNoise',
        params: { 
          frequency: 0.002, 
          octaves: 1, 
          amplitude: 0.3 
        },
        ui: { x: 0, y: 120 }
      },
      {
        id: 'local',
        type: 'PerlinNoise',
        params: { 
          frequency: 0.01, 
          octaves: 1, 
          amplitude: 0.1 
        },
        ui: { x: 0, y: 240 }
      },
      {
        id: 'blend-1',
        type: 'Blend',
        params: { mode: 'add' },
        ui: { x: 250, y: 60 }
      },
      {
        id: 'blend-2',
        type: 'Blend',
        params: { mode: 'add' },
        ui: { x: 500, y: 120 }
      }
    ],
    connections: [
      { from: 'continental', output: 'noise', to: 'blend-1', input: 'a' },
      { from: 'regional', output: 'noise', to: 'blend-1', input: 'b' },
      { from: 'blend-1', output: 'output', to: 'blend-2', input: 'a' },
      { from: 'local', output: 'noise', to: 'blend-2', input: 'b' }
    ],
    // External interface (how it connects to rest of graph)
    inputs: {
      seed: ['continental', 'regional', 'local']  // All 3 noise nodes get seed
    },
    outputs: {
      elevation: 'blend-2'  // Final output comes from blend-2
    }
  };
}
```

**Usage in UI:**

```javascript
// User clicks "Add Template → Base Elevation"
const template = createBaseElevationTemplate();
const macroNode = editor.addMacro(template);

// Shows as single collapsed node in UI
// Double-click to expand and see/edit internals
// Can export as template for reuse
```

---

### Phase 2: Update Graph Save/Load Format (Week 1)

#### 2.1 Enhanced Graph Format

**Current** (UI only):
```json
{
  "nodes": [
    { "id": "node-1", "type": "PerlinNoise", "x": 100, "y": 100, "params": {...} }
  ],
  "connections": [
    { "from": "node-1", "output": "noise", "to": "node-2", "input": "input" }
  ]
}
```

**New** (UI + V2 compatible):
```json
{
  "version": "2.0",
  "metadata": {
    "name": "My Terrain Pipeline",
    "description": "Eroded mountains with biomes",
    "author": "You",
    "created": "2025-10-23T01:00:00Z",
    "modified": "2025-10-23T09:00:00Z"
  },
  "settings": {
    "seed": 12345,
    "resolution": 512
  },
  "nodes": [
    {
      "id": "node-1",
      "type": "BaseElevation",  // Matches registry
      "params": {
        "continentalFreq": 0.0005,
        "continentalWeight": 0.6
      },
      "ui": {  // UI-only data (ignored by V2)
        "x": 100,
        "y": 100
      }
    },
    {
      "id": "node-2",
      "type": "HydraulicErosion",
      "params": {
        "iterations": 10,
        "particlesPerIteration": 10000,
        "erosionRate": 0.3
      },
      "ui": {
        "x": 350,
        "y": 100
      }
    }
  ],
  "connections": [
    {
      "from": "node-1",
      "output": "elevation",
      "to": "node-2",
      "input": "elevation"
    }
  ],
  "outputs": {
    "heightmap": "node-5",  // Which node produces final heightmap
    "biomes": "node-6",     // Which node produces biomes
    "moisture": "node-4"    // Which node produces moisture
  }
}
```

#### 2.2 Graph Storage

**File**: `storage/graphs/{worldId}/pipeline.json`

Each world has its own pipeline graph that defines how chunks are generated.

---

### Phase 3: Integrate UI → V2 Pipeline (Week 2)

#### 3.1 Save Button Behavior

**Current**: Saves graph for UI only

**New**: Save button does TWO things:
1. Save graph for UI restoration (same as before)
2. **Associate graph with a world** so V2 can use it

```javascript
// In UI (main.js)
async save() {
  const graph = this.editor.serialize();
  
  // Step 1: Save to database (for UI)
  await fetch('/api/save', {
    method: 'POST',
    body: JSON.stringify({ id: 'my_graph', graph })
  });
  
  // Step 2: Associate with world (for V2)
  const worldId = prompt('Link to world ID (or blank for test only):');
  if (worldId) {
    await fetch(`/api/v2/worlds/${worldId}/pipeline`, {
      method: 'POST',
      body: JSON.stringify({ graph })
    });
    alert(`✅ Graph saved AND linked to world: ${worldId}\n\nV2 pipeline will now use this graph!`);
  } else {
    alert(`✅ Graph saved for UI testing only`);
  }
}
```

#### 3.2 V2 Pipeline Loads Graph

**Current**: V2 pipeline has hardcoded node sequence

**New**: V2 pipeline loads graph from `storage/graphs/{worldId}/pipeline.json`

```javascript
// server/routes/chunksv2.js
async function getRegion(regionX, regionZ, seed, worldId) {
  // Load the pipeline graph for this world
  const graphPath = path.join('storage', 'graphs', worldId, 'pipeline.json');
  let graph;
  
  try {
    const graphData = await fs.readFile(graphPath, 'utf-8');
    graph = JSON.parse(graphData);
  } catch (error) {
    // Fallback to default pipeline
    console.warn(`No pipeline graph for ${worldId}, using default`);
    graph = getDefaultPipeline();
  }
  
  // Execute the graph
  const executor = new GraphExecutor(device, registry);
  const outputs = await executor.execute(graph, {
    seed,
    offsetX: regionX,
    offsetZ: regionZ
  });
  
  return {
    heightmap: outputs.heightmap,
    moisture: outputs.moisture,
    biomes: outputs.biomes,
    timings: executor.getTimings()
  };
}
```

#### 3.3 Graph Executor

**File**: `server/lib/GraphExecutor.js`

```javascript
export class GraphExecutor {
  constructor(device, nodeRegistry) {
    this.device = device;
    this.registry = nodeRegistry;
    this.timings = new Map();
  }

  async execute(graph, settings) {
    const nodeResults = new Map();
    
    // Topological sort (same as UI)
    const order = this.topologicalSort(graph);
    
    // Execute nodes in order
    for (const nodeId of order) {
      const nodeData = graph.nodes.find(n => n.id === nodeId);
      const NodeClass = this.registry.get(nodeData.type);
      
      const startTime = Date.now();
      
      // Create node instance with server context
      const node = new NodeClass({
        gpu: this.device,
        isServer: true
      });
      
      // Gather inputs from previous nodes
      const inputs = this.gatherInputs(nodeId, graph, nodeResults);
      
      // Merge settings with node params
      const params = { ...settings, ...nodeData.params };
      
      // Execute
      const result = await node.process(inputs, params);
      
      nodeResults.set(nodeId, result);
      this.timings.set(nodeId, Date.now() - startTime);
    }
    
    // Return outputs specified in graph
    const outputs = {};
    for (const [outputName, nodeId] of Object.entries(graph.outputs || {})) {
      outputs[outputName] = nodeResults.get(nodeId)[outputName];
    }
    
    return outputs;
  }

  topologicalSort(graph) {
    // Same implementation as UI
    // ...
  }

  gatherInputs(nodeId, graph, results) {
    const inputs = {};
    const connections = graph.connections.filter(c => c.to === nodeId);
    
    for (const conn of connections) {
      const sourceResult = results.get(conn.from);
      if (sourceResult && sourceResult[conn.output]) {
        inputs[conn.input] = sourceResult[conn.output];
      }
    }
    
    return inputs;
  }

  getTimings() {
    return Object.fromEntries(this.timings);
  }
}
```

---

### Phase 4: UI Updates (Week 2)

#### 4.1 Node Palette Updates

Update `views/index.ejs` to show unified nodes organized by type:

```html
<!-- Primitives: Generic building blocks -->
<div class="category">
  <h4>🧱 Primitives</h4>
  <div class="subcategory">
    <h5>Generators</h5>
    <button class="node-type-btn" data-type="PerlinNoise">🌊 Perlin Noise</button>
    <button class="node-type-btn" data-type="SimplexNoise">🌀 Simplex Noise</button>
    <button class="node-type-btn" data-type="Voronoi">🔷 Voronoi</button>
    <button class="node-type-btn" data-type="LatitudeGradient">📐 Gradient</button>
    <button class="node-type-btn" data-type="Constant">⚫ Constant</button>
  </div>
  <div class="subcategory">
    <h5>Operators</h5>
    <button class="node-type-btn" data-type="Blend">➕ Blend</button>
    <button class="node-type-btn" data-type="Remap">↔️ Remap</button>
    <button class="node-type-btn" data-type="Normalize">📏 Normalize</button>
    <button class="node-type-btn" data-type="Power">📈 Power</button>
    <button class="node-type-btn" data-type="Mask">🎭 Mask</button>
  </div>
</div>

<!-- Processors: Specialized algorithms -->
<div class="category">
  <h4>⚙️ Processors</h4>
  <div class="subcategory">
    <h5>Terrain</h5>
    <button class="node-type-btn" data-type="HydraulicErosion">💧 Hydraulic Erosion</button>
    <button class="node-type-btn" data-type="ThermalErosion">🏔️ Thermal Erosion</button>
    <button class="node-type-btn" data-type="Upscale">🔍 Upscale</button>
  </div>
  <div class="subcategory">
    <h5>Classification</h5>
    <button class="node-type-btn" data-type="BiomeClassifier">🌍 Biome Classifier</button>
    <button class="node-type-btn" data-type="BlockClassifier">🧊 Block Classifier</button>
  </div>
  <div class="subcategory">
    <h5>Generation</h5>
    <button class="node-type-btn" data-type="ChunkGenerator">📦 Chunk Generator</button>
    <button class="node-type-btn" data-type="CaveGenerator">🕳️ Cave Generator</button>
    <button class="node-type-btn" data-type="RiverFlow">🌊 River Flow</button>
  </div>
</div>

<!-- Templates: Pre-made composable subgraphs -->
<div class="category">
  <h4>📋 Templates</h4>
  <button class="node-type-btn template" data-template="BaseElevation">
    🏔️ Base Elevation (3 Perlin + Blend)
  </button>
  <button class="node-type-btn template" data-template="Temperature">
    🌡️ Temperature (Gradient + Perlin)
  </button>
  <button class="node-type-btn template" data-template="Moisture">
    💧 Moisture (Perlin)
  </button>
</div>
```

**Visual Design:**
- **Primitives** shown in blue (building blocks)
- **Processors** shown in red (specialized)
- **Templates** shown in purple (composable macros)
- Icons help identify node types quickly

#### 4.2 Pipeline Validation

Add validation to ensure graph is V2-compatible:

```javascript
// In UI
validateForV2(graph) {
  const errors = [];
  
  // Check: Must have required outputs
  const requiredOutputs = ['heightmap', 'biomes'];
  for (const output of requiredOutputs) {
    if (!graph.outputs || !graph.outputs[output]) {
      errors.push(`Missing required output: ${output}`);
    }
  }
  
  // Check: All nodes must be registered
  for (const node of graph.nodes) {
    if (!registry.get(node.type)) {
      errors.push(`Unknown node type: ${node.type}`);
    }
  }
  
  // Check: No cycles
  if (this.hasCycles(graph)) {
    errors.push('Graph contains cycles');
  }
  
  return errors;
}
```

Show validation status in UI:

```html
<div class="validation-status">
  <span id="v2-compatible">✅ V2 Compatible</span>
  <button onclick="showValidation()">Check V2 Compatibility</button>
</div>
```

---

### Phase 5: Migration Path (Week 3)

#### 5.1 Migrate Existing Nodes

**Strategy**: Port existing client-side nodes to unified format

**Priority Order**:
1. **Critical Path** (must have):
   - ✅ BaseElevationNode
   - ✅ HydraulicErosionNode  
   - ✅ UpscaleNode
   - ⚠️ BiomeClassifierNode (needs porting)
   - ⚠️ ChunkGeneratorNode (needs updating)

2. **High Priority** (common use):
   - BlendNode
   - NormalizeNode
   - TemperatureNode
   - WaterNode (rivers)

3. **Medium Priority** (nice to have):
   - TerraceNode
   - SlopeMapNode
   - GradientMapNode

4. **Low Priority** (special effects):
   - SurfaceAnimationNode (UI only!)
   - FeaturesNode
   - TrailsNode

#### 5.2 Default Pipeline Template

Create a default pipeline that works in both contexts:

```javascript
// shared/templates/DefaultPipelineTemplate.js
export function getDefaultPipeline() {
  return {
    version: '2.0',
    metadata: {
      name: 'Default Terrain Pipeline',
      description: 'Eroded terrain with biomes - uses composable primitives'
    },
    nodes: [
      // Base Elevation (3 Perlin + 2 Blend - could be macro)
      { id: 'seed', type: 'SeedInput', params: {} },
      { id: 'base-cont', type: 'PerlinNoise', params: { frequency: 0.0005, amplitude: 0.6 } },
      { id: 'base-reg', type: 'PerlinNoise', params: { frequency: 0.002, amplitude: 0.3 } },
      { id: 'base-local', type: 'PerlinNoise', params: { frequency: 0.01, amplitude: 0.1 } },
      { id: 'base-blend1', type: 'Blend', params: { mode: 'add' } },
      { id: 'base-blend2', type: 'Blend', params: { mode: 'add' } },
      
      // Pre-Erosion Moisture (just Perlin)
      { id: 'pre-moisture', type: 'PerlinNoise', params: { frequency: 0.001 } },
      
      // Erosion (processor)
      { id: 'erosion', type: 'HydraulicErosion', params: { iterations: 10 } },
      
      // Post-Erosion Moisture (just Perlin with different freq)
      { id: 'post-moisture', type: 'PerlinNoise', params: { frequency: 0.0012, offsetX: 5000 } },
      
      // Upscale (processors)
      { id: 'upscale-height', type: 'Upscale', params: { from: 128, to: 512 } },
      { id: 'upscale-moisture', type: 'Upscale', params: { from: 128, to: 512 } },
      
      // Temperature (Gradient + Perlin + Blend)
      { id: 'lat-gradient', type: 'LatitudeGradient', params: {} },
      { id: 'temp-noise', type: 'PerlinNoise', params: { frequency: 0.002, amplitude: 0.2 } },
      { id: 'temp-blend', type: 'Blend', params: { mode: 'add' } },
      
      // Biome Classification (processor)
      { id: 'biomes', type: 'BiomeClassifier', params: { biomeRules: [...] } }
    ],
    connections: [
      // Base elevation chain
      { from: 'seed', output: 'seed', to: 'base-cont', input: 'seed' },
      { from: 'seed', output: 'seed', to: 'base-reg', input: 'seed' },
      { from: 'seed', output: 'seed', to: 'base-local', input: 'seed' },
      { from: 'base-cont', output: 'noise', to: 'base-blend1', input: 'a' },
      { from: 'base-reg', output: 'noise', to: 'base-blend1', input: 'b' },
      { from: 'base-blend1', output: 'output', to: 'base-blend2', input: 'a' },
      { from: 'base-local', output: 'noise', to: 'base-blend2', input: 'b' },
      
      // Erosion
      { from: 'base-blend2', output: 'output', to: 'erosion', input: 'elevation' },
      { from: 'pre-moisture', output: 'noise', to: 'erosion', input: 'moisture' },
      
      // Upscaling
      { from: 'erosion', output: 'elevation', to: 'upscale-height', input: 'input' },
      { from: 'post-moisture', output: 'noise', to: 'upscale-moisture', input: 'input' },
      
      // Temperature
      { from: 'lat-gradient', output: 'gradient', to: 'temp-blend', input: 'a' },
      { from: 'temp-noise', output: 'noise', to: 'temp-blend', input: 'b' },
      
      // Biomes
      { from: 'upscale-height', output: 'output', to: 'biomes', input: 'elevation' },
      { from: 'upscale-moisture', output: 'output', to: 'biomes', input: 'moisture' },
      { from: 'temp-blend', output: 'output', to: 'biomes', input: 'temperature' }
    ],
    outputs: {
      heightmap: 'upscale-height',
      moisture: 'upscale-moisture',
      temperature: 'temp-blend',
      biomes: 'biomes'
    }
  };
}
```

**Key Difference**: Uses **primitives** (`PerlinNoise`, `Blend`, `LatitudeGradient`) instead of hardcoded domain nodes. More flexible and easier to understand!

---

## 🎮 User Workflow

### Scenario: Design New Terrain

1. **Open UI** (`http://localhost:3012/`)
2. **Add nodes** from palette (drag, connect)
3. **Adjust parameters** (erosion strength, noise frequencies)
4. **Preview in real-time** (see heightmap/biomes update)
5. **Save graph** → Link to world ID: `my_world`
6. **Test in game** → `http://localhost:3012/world?id=my_world`
7. **Iterate**: Adjust nodes → Save → Reload world

**Result**: UI design directly controls V2 chunk generation! 🎉

---

## 📊 Benefits

### ✅ Unified System
- **One source of truth** for node definitions
- No more drift between UI and V2
- Share improvements automatically

### ✅ Visual Design
- **Design pipelines visually** (no code)
- **Preview results** before deploying
- **Iterate quickly** with real-time feedback

### ✅ Flexibility
- **Mix and match** nodes
- **Multiple pipelines** per project (desert world, ice world, etc.)
- **Version control** graphs as JSON

### ✅ Debugging
- **See intermediate outputs** in UI
- **Identify bottlenecks** with timing per node
- **A/B test** different erosion settings

### ✅ Extensibility
- **Add new nodes** once, works everywhere
- **Community nodes** possible (import/export)
- **Plugin system** for custom nodes

---

## 🛠️ Technical Details

### GPU Context Abstraction

**Problem**: Browser WebGPU ≠ Node.js @webgpu/node

**Solution**: Abstract GPU interface

```javascript
// shared/GPUContext.js
export class GPUContext {
  constructor(device, isServer) {
    this.device = device;
    this.isServer = isServer;
  }

  createBuffer(size, usage) {
    return this.device.createBuffer({ size, usage });
  }

  createBufferWithData(data, usage) {
    const buffer = this.createBuffer(data.byteLength, usage);
    this.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  async readBuffer(buffer, size) {
    // Platform-specific implementation
    if (this.isServer) {
      return await this.readBufferServer(buffer, size);
    } else {
      return await this.readBufferBrowser(buffer, size);
    }
  }
  
  // ... more abstracted methods
}
```

### Node Metadata

Nodes can include metadata for UI enhancement:

```javascript
static uiMetadata = {
  color: '#ff6b6b',  // Node color in graph
  icon: '🌋',         // Icon for palette
  description: 'Simulates hydraulic erosion using GPU particles',
  tags: ['terrain', 'erosion', 'expensive'],
  
  paramRanges: {
    iterations: { min: 1, max: 20, step: 1 },
    erosionRate: { min: 0, max: 1, step: 0.01 }
  },
  
  previewable: true,  // Can show preview in UI
  cacheable: true,    // Results can be cached in V2
  
  performance: {
    complexity: 'O(n² × iterations)',
    typical: '50ms @ 128×128, 10 iterations'
  }
};
```

---

## 📁 File Structure

```
visual-world-gen/
├── shared/                      # NEW: Isomorphic code
│   ├── nodes/
│   │   ├── BaseNode.js         # Base class (works both sides)
│   │   ├── sources/
│   │   │   ├── BaseElevationNode.js
│   │   │   ├── PreErosionMoistureNode.js
│   │   │   └── PostErosionMoistureNode.js
│   │   ├── processors/
│   │   │   ├── HydraulicErosionNode.js
│   │   │   ├── UpscaleNode.js
│   │   │   └── BlendNode.js
│   │   ├── classifiers/
│   │   │   ├── BiomeClassifierNode.js
│   │   │   └── TemperatureNode.js
│   │   └── generators/
│   │       └── ChunkGeneratorNode.js
│   ├── NodeRegistry.js
│   ├── GraphExecutor.js
│   ├── GPUContext.js
│   └── templates/
│       └── DefaultPipeline.js
│
├── server/
│   ├── lib/
│   │   ├── nodes/ (REMOVE - merged into shared/)
│   │   └── nodesv2/ (REMOVE - merged into shared/)
│   ├── routes/
│   │   ├── chunksv2.js (UPDATE: use GraphExecutor)
│   │   └── graphs.js (NEW: CRUD for pipelines)
│   └── index.js
│
├── public/
│   ├── js/
│   │   ├── nodes/ (REMOVE - merged into shared/)
│   │   ├── nodeEditor.js (UPDATE: use shared registry)
│   │   ├── pipeline.js (UPDATE: use GraphExecutor)
│   │   └── main.js (UPDATE: save to world)
│   └── css/
│
├── storage/
│   ├── graphs/
│   │   ├── {worldId}/
│   │   │   └── pipeline.json  # World's pipeline
│   │   └── templates/
│   │       └── *.json  # Template pipelines
│   └── worlds/
│
└── views/
    └── index.ejs (UPDATE: new node palette)
```

---

## 🚀 Rollout Strategy

### Week 1: Foundation (Primitives First!)
- [ ] Create `shared/` directory structure
- [ ] Create `shared/nodes/BaseNode.js`
- [ ] Create **PerlinNoiseNode** (primitive - 40 lines)
- [ ] Create **BlendNode** (primitive - 35 lines)
- [ ] Create **RemapNode** (primitive - 30 lines)
- [ ] Port **HydraulicErosionNode** to shared (processor)
- [ ] Port **UpscaleNode** to shared (processor)
- [ ] Create NodeRegistry
- [ ] Create GraphExecutor
- [ ] Test: Perlin → Blend → Output in UI
- [ ] Test: Same graph runs in V2

### Week 2: Integration & Templates
- [ ] Create **BaseElevationTemplate** (3 Perlin + 2 Blend)
- [ ] Create **TemperatureTemplate** (Gradient + Perlin + Blend)
- [ ] Create remaining primitives (6 more)
- [ ] Update V2 pipeline to use GraphExecutor
- [ ] Update UI to use shared nodes
- [ ] Add template support in UI (macro nodes)
- [ ] Add world linking to save button
- [ ] Test: Design template → Save → V2 uses it

### Week 3: Processors & Validation
- [ ] Port BiomeClassifierNode (processor)
- [ ] Port ChunkGeneratorNode (processor)
- [ ] Port remaining processors (3-4 more)
- [ ] Create DefaultPipelineTemplate (complete working example)
- [ ] Add validation UI (V2 compatibility check)
- [ ] Add node documentation/tooltips
- [ ] Performance testing

### Week 4: Polish & Features
- [ ] Add graph versioning
- [ ] Add import/export
- [ ] Add macro expand/collapse in UI
- [ ] Add "Save as Template" feature
- [ ] Performance profiling per node
- [ ] Documentation and examples

---

## 🎯 Success Criteria

### Functional
- ✅ Design pipeline in UI
- ✅ Save pipeline
- ✅ V2 uses saved pipeline for chunks
- ✅ Same results in UI preview and V2 output
- ✅ Parameter changes propagate

### Quality
- ✅ No code duplication
- ✅ Single node definition
- ✅ Consistent behavior
- ✅ Easy to add new nodes

### User Experience
- ✅ Intuitive workflow
- ✅ Real-time feedback
- ✅ No manual configuration
- ✅ Version control friendly

---

## 💡 Future Enhancements

### Node Marketplace
- Share pipelines with community
- Rate/review pipelines
- One-click import

### Live Pipeline Editing
- Edit pipeline while world is running
- Hot-reload chunks
- A/B test in real-time

### Node Optimization
- Auto-detect bottlenecks
- Suggest optimizations
- Cache intermediate results

### Advanced Features
- Conditional nodes (if/else logic)
- Loop nodes (for iterations)
- Macro nodes (subgraphs)
- Custom WGSL shaders

---

## 📝 Summary

**Before**:
```
UI Nodes (client) ≠ V2 Nodes (server)
        ↓
Design in UI, hardcode in V2
        ↓
     Drift 😢
```

**After**:
```
Shared Node Definitions
        ↓
Design in UI → Save → V2 Uses Graph
        ↓
    Unified 🎉
```

**The Big Win**: One node system, two contexts. Design visually, deploy automatically!

---

## 📊 Monitoring Integration

### Node Execution Tracking

Every node execution is reported to the monitor we built:

```javascript
// shared/GraphExecutor.js
export class GraphExecutor {
  constructor(device, nodeRegistry, monitor = null) {
    this.device = device;
    this.registry = nodeRegistry;
    this.monitor = monitor; // Optional monitor for metrics
    this.timings = new Map();
  }

  async execute(graph, settings) {
    const nodeResults = new Map();
    const order = this.topologicalSort(graph);
    
    for (const nodeId of order) {
      const nodeData = graph.nodes.find(n => n.id === nodeId);
      const NodeClass = this.registry.get(nodeData.type);
      
      const startTime = Date.now();
      const node = new NodeClass({ gpu: this.device, isServer: true });
      
      // Gather inputs
      const inputs = this.gatherInputs(nodeId, graph, nodeResults);
      const params = { ...settings, ...nodeData.params };
      
      // Execute node
      const result = await node.process(inputs, params);
      const executionTime = Date.now() - startTime;
      
      // Store result
      nodeResults.set(nodeId, result);
      this.timings.set(nodeId, executionTime);
      
      // Report to monitor
      if (this.monitor) {
        this.monitor.recordNodeExecution({
          nodeId,
          nodeType: nodeData.type,
          category: NodeClass.category, // 'Primitives' or 'Processors'
          executionTime,
          cached: result._cached || false,
          inputSizes: this.getInputSizes(inputs),
          outputSizes: this.getOutputSizes(result)
        });
      }
    }
    
    return { outputs: this.extractOutputs(graph, nodeResults), timings: this.timings };
  }
}
```

### Monitor Aggregation

The monitor aggregates node metrics by type and category:

```javascript
// server/routes/monitor.js - Enhanced MetricsCollector
class MetricsCollector {
  constructor() {
    this.nodeMetrics = new Map(); // Track per-node-type metrics
    // ... existing fields
  }

  recordNodeExecution(data) {
    const { nodeType, category, executionTime, cached } = data;
    
    // Initialize if first time seeing this node type
    if (!this.nodeMetrics.has(nodeType)) {
      this.nodeMetrics.set(nodeType, {
        type: nodeType,
        category,
        executions: 0,
        totalTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        samples: [] // Last 100 execution times
      });
    }
    
    const metrics = this.nodeMetrics.get(nodeType);
    metrics.executions++;
    metrics.totalTime += executionTime;
    
    if (cached) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }
    
    metrics.samples.push(executionTime);
    if (metrics.samples.length > 100) {
      metrics.samples.shift();
    }
  }

  getNodeStats() {
    const stats = {
      byType: {},
      byCategory: { Primitives: {}, Processors: {} }
    };
    
    for (const [type, metrics] of this.nodeMetrics) {
      const avgTime = metrics.totalTime / metrics.executions;
      const cacheRate = (metrics.cacheHits / metrics.executions) * 100;
      const recentAvg = avg(metrics.samples);
      
      const nodeStat = {
        type,
        category: metrics.category,
        executions: metrics.executions,
        avgTime: avgTime.toFixed(2),
        recentAvg: recentAvg.toFixed(2),
        cacheRate: cacheRate.toFixed(1),
        totalTime: metrics.totalTime
      };
      
      stats.byType[type] = nodeStat;
      
      // Aggregate by category
      if (!stats.byCategory[metrics.category][type]) {
        stats.byCategory[metrics.category][type] = nodeStat;
      }
    }
    
    return stats;
  }
}
```

### Monitor Dashboard Display

Update the monitor to show node-level performance:

```html
<!-- views/monitor.ejs -->
<section class="node-performance-section">
  <h3>Node Performance Breakdown</h3>
  
  <div class="node-category">
    <h4>🧱 Primitives (Building Blocks)</h4>
    <table class="node-perf-table">
      <thead>
        <tr>
          <th>Node Type</th>
          <th>Executions</th>
          <th>Avg Time</th>
          <th>Recent Avg</th>
          <th>Cache Rate</th>
          <th>Total Time</th>
        </tr>
      </thead>
      <tbody id="primitives-perf">
        <!-- Populated by JS -->
      </tbody>
    </table>
  </div>
  
  <div class="node-category">
    <h4>⚙️ Processors (Algorithms)</h4>
    <table class="node-perf-table">
      <thead>
        <tr>
          <th>Node Type</th>
          <th>Executions</th>
          <th>Avg Time</th>
          <th>Recent Avg</th>
          <th>Cache Rate</th>
          <th>Total Time</th>
        </tr>
      </thead>
      <tbody id="processors-perf">
        <!-- Populated by JS -->
      </tbody>
    </table>
  </div>
</section>
```

**What You'll See:**
```
🧱 Primitives (Building Blocks)
┌─────────────────┬────────────┬──────────┬────────────┬────────────┬────────────┐
│ Node Type       │ Executions │ Avg Time │ Recent Avg │ Cache Rate │ Total Time │
├─────────────────┼────────────┼──────────┼────────────┼────────────┼────────────┤
│ PerlinNoise     │    8,450   │   2.1ms  │    1.9ms   │   95.2%    │   17.7s    │
│ Blend           │    5,633   │   0.3ms  │    0.3ms   │   98.1%    │    1.7s    │
│ Remap           │    2,817   │   0.2ms  │    0.2ms   │   99.5%    │    0.6s    │
└─────────────────┴────────────┴──────────┴────────────┴────────────┴────────────┘

⚙️ Processors (Algorithms)
┌─────────────────┬────────────┬──────────┬────────────┬────────────┬────────────┐
│ Node Type       │ Executions │ Avg Time │ Recent Avg │ Cache Rate │ Total Time │
├─────────────────┼────────────┼──────────┼────────────┼────────────┼────────────┤
│ HydraulicErosion│     485    │  52.3ms  │   51.8ms   │   12.4%    │   25.4s    │
│ Upscale         │     970    │   8.7ms  │    8.5ms   │   50.0%    │    8.4s    │
│ BiomeClassifier │     485    │   3.2ms  │    3.1ms   │   50.0%    │    1.6s    │
└─────────────────┴────────────┴──────────┴────────────┴────────────┴────────────┘
```

**Key Insights:**
- **Primitives** have high cache rates (fast, deterministic)
- **Processors** vary (erosion is slow, low cache rate)
- Can identify bottlenecks at node level

---

## 💾 Caching Strategy

### Three-Level Cache Hierarchy

```
┌─────────────────────────────────────────────────────┐
│  Level 1: Node Result Cache (In-Memory)             │
│  • Cache individual node outputs                     │
│  • Key: (nodeType + params + inputs)                │
│  • Fast lookups (< 1ms)                              │
│  • LRU eviction (1000 entries)                       │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Level 2: Region Cache (GPU VRAM)                   │
│  • Cache complete region outputs                     │
│  • Key: (regionX, regionZ, seed, graphHash)         │
│  • 20 regions (~100MB VRAM)                          │
│  • Persists across chunk requests                    │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Level 3: Chunk Cache (Disk)                        │
│  • Cache final SVDAG chunks                          │
│  • Key: (cx, cy, cz, worldId)                       │
│  • Persistent across server restarts                 │
│  • LRU eviction (10,000 chunks)                      │
└─────────────────────────────────────────────────────┘
```

### Node-Level Caching

**Cacheable Nodes** (deterministic):
- ✅ All Primitives (`PerlinNoise`, `Blend`, etc.)
- ✅ Some Processors (`Upscale`, `BiomeClassifier`)

**Non-Cacheable Nodes** (position-dependent or expensive to cache):
- ❌ `ChunkGenerator` (too many positions)
- ❌ `CaveGenerator` (too many positions)
- ⚠️ `HydraulicErosion` (expensive, but cacheable at region level)

```javascript
// shared/nodes/BaseNode.js
export class BaseNode {
  static cacheable = true; // Override per node
  static cacheKeyParams = ['frequency', 'octaves']; // Which params matter for cache

  async process(inputs, params) {
    // Check cache if this node is cacheable
    if (this.constructor.cacheable && this.cache) {
      const cacheKey = this.getCacheKey(inputs, params);
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        return { ...cached, _cached: true };
      }
    }
    
    // Execute node
    const result = await this.execute(inputs, params);
    
    // Store in cache
    if (this.constructor.cacheable && this.cache) {
      const cacheKey = this.getCacheKey(inputs, params);
      this.cache.set(cacheKey, result);
    }
    
    return result;
  }

  getCacheKey(inputs, params) {
    const keyParams = this.constructor.cacheKeyParams || Object.keys(params);
    const paramStr = keyParams.map(k => `${k}:${params[k]}`).join('|');
    const inputHash = this.hashInputs(inputs);
    return `${this.constructor.type}:${paramStr}:${inputHash}`;
  }

  hashInputs(inputs) {
    // Simple hash of input data (could use crypto hash)
    let hash = 0;
    for (const key in inputs) {
      const data = inputs[key];
      if (data instanceof Float32Array || data instanceof Uint32Array) {
        // Sample-based hash (first, middle, last values)
        hash ^= data[0] ^ data[Math.floor(data.length / 2)] ^ data[data.length - 1];
      }
    }
    return hash.toString(36);
  }
}
```

### Region-Level Caching

Region cache stores complete pipeline outputs for a region:

```javascript
// server/routes/chunksv2.js
const regionCache = new Map(); // Key: `${regionX}_${regionZ}_${graphHash}_${seed}`

async function getRegion(regionX, regionZ, seed, worldId) {
  // Load pipeline graph for this world
  const graph = await loadPipelineGraph(worldId);
  const graphHash = hashGraph(graph); // Hash graph structure + params
  
  const cacheKey = `${regionX}_${regionZ}_${graphHash}_${seed}`;
  
  // Check cache
  if (regionCache.has(cacheKey)) {
    const cached = regionCache.get(cacheKey);
    console.log(`✅ Region cache hit: ${cacheKey}`);
    return { ...cached, wasCached: true };
  }
  
  console.log(`⚠️ Region cache miss: ${cacheKey}`);
  
  // Execute pipeline
  const executor = new GraphExecutor(device, registry, metrics);
  const outputs = await executor.execute(graph, {
    seed,
    offsetX: regionX,
    offsetZ: regionZ,
    resolution: 128 // LOD 0
  });
  
  // Cache result
  const region = {
    heightmap: outputs.heightmap,
    moisture: outputs.moisture,
    biomes: outputs.biomes,
    timings: outputs.timings,
    wasCached: false
  };
  
  regionCache.set(cacheKey, region);
  
  // LRU eviction
  if (regionCache.size > 20) {
    const oldestKey = regionCache.keys().next().value;
    regionCache.delete(oldestKey);
    console.log(`🗑️ Evicted region: ${oldestKey}`);
  }
  
  return region;
}

function hashGraph(graph) {
  // Hash graph structure (nodes + connections + params)
  const graphStr = JSON.stringify({
    nodes: graph.nodes.map(n => ({ type: n.type, params: n.params })),
    connections: graph.connections
  });
  
  // Simple hash (could use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < graphStr.length; i++) {
    hash = ((hash << 5) - hash) + graphStr.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}
```

### Cache Invalidation

**When to Invalidate:**

1. **Graph Changed** - New graph hash invalidates region cache
2. **Parameters Changed** - Node param change invalidates node cache
3. **Manual Invalidation** - User requests cache clear

```javascript
// API endpoint for cache management
router.post('/api/v2/worlds/:worldId/cache/clear', async (req, res) => {
  const { worldId } = req.params;
  const { level } = req.body; // 'node', 'region', 'chunk', 'all'
  
  switch (level) {
    case 'node':
      nodeCache.clear();
      console.log('🗑️ Cleared node cache');
      break;
    case 'region':
      regionCache.clear();
      console.log('🗑️ Cleared region cache');
      break;
    case 'chunk':
      await clearChunkCache(worldId);
      console.log('🗑️ Cleared chunk cache');
      break;
    case 'all':
      nodeCache.clear();
      regionCache.clear();
      await clearChunkCache(worldId);
      console.log('🗑️ Cleared all caches');
      break;
  }
  
  res.json({ success: true, level });
});
```

### Cache Performance Impact

**Example Region Generation (128×128):**

```
First Request (Cold Cache):
├─ PerlinNoise (continental)  2.1ms   [MISS]
├─ PerlinNoise (regional)     2.0ms   [MISS]
├─ PerlinNoise (local)        1.9ms   [MISS]
├─ Blend                      0.3ms   [MISS]
├─ Blend                      0.3ms   [MISS]
├─ PerlinNoise (moisture)     2.0ms   [MISS]
├─ HydraulicErosion          52.3ms   [MISS]
├─ Upscale                    8.7ms   [MISS]
├─ BiomeClassifier            3.2ms   [MISS]
└─ TOTAL:                    72.8ms

Second Request (Same Region):
└─ Region Cache HIT:          0.1ms   ✅ 728x faster!

Third Request (Different Region, Same Seed):
├─ PerlinNoise (continental)  0.1ms   [HIT] ✅
├─ PerlinNoise (regional)     0.1ms   [HIT] ✅
├─ PerlinNoise (local)        0.1ms   [HIT] ✅
├─ Blend                      0.3ms   [MISS] (different inputs)
├─ Blend                      0.3ms   [MISS]
├─ PerlinNoise (moisture)     0.1ms   [HIT] ✅
├─ HydraulicErosion          52.3ms   [MISS] (depends on position)
├─ Upscale                    0.1ms   [HIT] ✅
├─ BiomeClassifier            3.2ms   [MISS]
└─ TOTAL:                    56.6ms   (22% faster)
```

**Key Insight**: Node cache helps even when region cache misses!

---

## 🎨 Code Reduction: Before vs After

### Before (Hardcoded Domain Nodes):
```
BaseElevationNode.js        163 lines  ❌ Duplicates Perlin logic
PreErosionMoistureNode.js   120 lines  ❌ Just Perlin with different freq
PostErosionMoistureNode.js  120 lines  ❌ Also just Perlin
TemperatureNode.js           95 lines  ❌ Perlin + Gradient hardcoded
WaterNode.js                 85 lines  ❌ Another Perlin variant
───────────────────────────────────────
Total:                      583 lines  ❌ Lots of duplication!
```

### After (Composable Primitives):
```
PerlinNoiseNode.js           40 lines  ✅ Generic, reusable
LatitudeGradientNode.js      30 lines  ✅ Generic, reusable
BlendNode.js                 35 lines  ✅ Generic, reusable
RemapNode.js                 30 lines  ✅ Generic, reusable
NormalizeNode.js             28 lines  ✅ Generic, reusable

BaseElevationTemplate.js     25 lines  ✅ Just a graph
TemperatureTemplate.js       20 lines  ✅ Just a graph
MoistureTemplate.js          15 lines  ✅ Just a graph
───────────────────────────────────────
Total:                      223 lines  ✅ 62% reduction!
```

**Plus:**
- ✅ More flexible (can try Simplex instead of Perlin)
- ✅ More composable (reuse BlendNode everywhere)
- ✅ Easier to understand (each node does one thing)
- ✅ Templates are just data (no code)

---

## 📊 Final Node Count

### Primitives (10 nodes - LEGO blocks):
1. **PerlinNoiseNode** - Classic noise
2. **SimplexNoiseNode** - Improved noise
3. **VoronoiNode** - Cellular patterns
4. **LatitudeGradientNode** - Linear gradients
5. **ConstantNode** - Fixed values
6. **BlendNode** - Combine two inputs
7. **RemapNode** - Scale/offset values
8. **NormalizeNode** - Normalize to 0-1
9. **PowerNode** - Raise to power
10. **MaskNode** - Conditional selection

### Processors (8 nodes - Specialized tools):
1. **HydraulicErosionNode** - Particle-based erosion
2. **ThermalErosionNode** - Talus-based erosion
3. **UpscaleNode** - Bilinear/bicubic upscaling
4. **BiomeClassifierNode** - Rule-based biome assignment
5. **BlockClassifierNode** - Voxel type assignment
6. **ChunkGeneratorNode** - 3D voxel generation
7. **CaveGeneratorNode** - Cave carving
8. **RiverFlowNode** - Flow accumulation

### Templates (Composable - no code!):
- **BaseElevation** - 3× PerlinNoise + 2× Blend
- **Temperature** - LatitudeGradient + PerlinNoise + Blend
- **Moisture** - PerlinNoise (with different params)
- **DefaultPipeline** - Complete working pipeline

**Total: 18 nodes + unlimited templates!**

---

## 💡 Why This Is Better

### 1. **No Duplication**
- **Before**: `BaseElevationNode`, `TemperatureNode`, `MoistureNode` all reimplemented Perlin
- **After**: One `PerlinNoiseNode`, used 3 different ways

### 2. **Maximum Flexibility**
- **Before**: Want to try Simplex noise for temperature? Rewrite `TemperatureNode`
- **After**: Just swap `PerlinNoise` → `SimplexNoise` in graph

### 3. **Easier Debugging**
- **Before**: Bug in Perlin? Fix in 5 different files
- **After**: Bug in Perlin? Fix in one place

### 4. **Composability**
- **Before**: Want base elevation with different blend mode? Modify node code
- **After**: Just change `BlendNode` parameter `mode: 'multiply'`

### 5. **Visual Understanding**
- **Before**: "What does BaseElevationNode do?" → Read 163 lines of code
- **After**: "What does BaseElevation do?" → Look at graph (3 Perlin + 2 Blend)

### 6. **Easy to Extend**
- **Before**: Want "WindErosion"? Write 150-line node
- **After**: If it's generic (like noise), add primitive. If specialized, add processor.

---

## 🎯 The Vision Realized

**Your Original Request:**
> "There are actually two kinds of node - ones that generate a noise source and those that run an algorithm with inputs including those noise sources. Temperature node is just a noise source for example - it should be a noise node that is just renamed."

**What We're Building:**
- ✅ **Primitives** = Generic noise sources and operators (the LEGO blocks)
- ✅ **Processors** = Specialized algorithms (the tools)
- ✅ **Templates** = Pre-built combinations (the blueprints)

**Result:**
- Design in UI using primitives
- Compose into templates for reuse
- V2 pipeline executes your exact graph
- No drift, no duplication, maximum flexibility!

---

**Ready to implement?** Start with Week 1, Task 1: Create `shared/nodes/primitives/PerlinNoiseNode.js` 🚀

**The first primitive node is the foundation - once we have PerlinNoise working in both UI and V2, the rest follows naturally!**
