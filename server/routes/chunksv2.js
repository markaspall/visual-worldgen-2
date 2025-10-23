/**
 * Chunk API Routes V2
 * Unified node-based pipeline
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SVDAGBuilder } from '../services/svdagBuilder.js';
import { metrics } from './monitor.js';

// Import unified node system
import { NodeRegistry } from '../../shared/NodeRegistry.js';
import { GraphExecutor } from '../../shared/GraphExecutor.js';
import { PerlinNoiseNode } from '../../shared/nodes/primitives/PerlinNoiseNode.js';
import { BlendNode } from '../../shared/nodes/primitives/BlendNode.js';
import { RemapNode } from '../../shared/nodes/primitives/RemapNode.js';
import { NormalizeNode } from '../../shared/nodes/primitives/NormalizeNode.js';
import { GradientNode } from '../../shared/nodes/primitives/GradientNode.js';
import { ConstantNode } from '../../shared/nodes/primitives/ConstantNode.js';
import { BiomeClassifierNode } from '../../shared/nodes/processors/BiomeClassifierNode.js';
import { DownsampleNode } from '../../shared/nodes/processors/DownsampleNode.js';
import { UpsampleNode } from '../../shared/nodes/processors/UpsampleNode.js';
import { HydraulicErosionNode } from '../../shared/nodes/processors/HydraulicErosionNode.js';
import { ElevationOutputNode } from '../../shared/nodes/outputs/ElevationOutputNode.js';
import { nodeMonitor } from '../lib/NodeMonitor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

// Get WORLD_ID from app.locals (set in server.js)
let WORLD_ID = 'test_world'; // Default fallback

// Middleware to ensure WORLD_ID is set
router.use((req, res, next) => {
  WORLD_ID = req.app.locals.worldId || 'test_world';
  next();
});

// Make nodeMonitor available globally for BaseNode
global.nodeMonitor = nodeMonitor;

// Node registry
const registry = new NodeRegistry();

// Register all available nodes
// Primitives
registry.register(PerlinNoiseNode);
registry.register(BlendNode);
registry.register(RemapNode);
registry.register(NormalizeNode);
registry.register(GradientNode);
registry.register(ConstantNode);

// Processors
registry.register(BiomeClassifierNode);
registry.register(DownsampleNode);
registry.register(UpsampleNode);
registry.register(HydraulicErosionNode);

// Outputs
registry.register(ElevationOutputNode);

console.log('📦 Registered nodes:', registry.getTypes());
console.log('   Primitives:', registry.getByCategory('Primitives').join(', '));
console.log('   Processors:', registry.getByCategory('Processors').join(', '));
console.log('   Outputs:', registry.getByCategory('Outputs').join(', '));

// Graph executor
const executor = new GraphExecutor(registry, {
  monitor: null, // TODO: Add proper monitor integration later
  cache: new Map()
});

// SVDAG builder for chunk compression
const svdagBuilder = new SVDAGBuilder();

// Keep process alive
setInterval(() => {}, 30000);
console.log('✅ V2 unified pipeline loaded');

// In-memory region cache
const regionCache = new Map();

/**
 * Load or create default pipeline graph
 */
async function loadPipeline() {
  const worldDir = path.join(path.dirname(__dirname), '../storage/worlds', WORLD_ID);
  const pipelinePath = path.join(worldDir, 'pipeline.json');
  
  try {
    const data = await fs.readFile(pipelinePath, 'utf-8');
    const graph = JSON.parse(data);
    console.log(`📊 Loaded pipeline for world '${WORLD_ID}' (${graph.nodes?.length || 0} nodes)`);
    return graph;
  } catch (err) {
    // No pipeline.json - create default (single PerlinNoise node)
    console.log(`⚠️  No pipeline.json for '${WORLD_ID}', using default (PerlinNoise)`);
    
    return {
      nodes: [
        {
          id: 'perlin1',
          type: 'PerlinNoise',
          params: {
            frequency: 0.001,
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2.0,
            amplitude: 1.0
          },
          isOutput: true
        }
      ],
      connections: []
    };
  }
}

/**
 * Generate or retrieve region data using graph executor
 */
async function getRegion(regionX, regionZ, seed) {
  const regionKey = `${regionX}_${regionZ}_${seed}`;
  
  // Check cache first
  if (regionCache.has(regionKey)) {
    return regionCache.get(regionKey);
  }

  console.log(`\n🌍 Generating region: (${regionX}, ${regionZ}) - UNIFIED PIPELINE`);
  const regionStartTime = Date.now();

  // Load pipeline graph
  const graph = await loadPipeline();

  // Execute graph
  // Convert region indices to world coordinates (each region is 512x512)
  const result = await executor.execute(graph, {
    seed,
    offsetX: regionX * 512,
    offsetZ: regionZ * 512,
    resolution: 512
  });

  // Extract heightmap from result
  // Try to get elevation output, fall back to noise for backwards compatibility
  const heightmap = result.outputs.elevation || result.outputs.noise || result.outputs.output;

  if (!heightmap) {
    console.error('Available outputs:', Object.keys(result.outputs));
    throw new Error('Pipeline did not produce heightmap output (expected "elevation", "noise", or "output")');
  }

  const regionData = {
    heightmap,
    resolution: 512,
    timings: result.timings,
    cacheStats: result.cacheStats
  };

  // Cache the region
  regionCache.set(regionKey, regionData);
  
  // Calculate height statistics
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  let avgHeight = 0;
  for (let i = 0; i < heightmap.length; i++) {
    const h = heightmap[i] * 256;
    minHeight = Math.min(minHeight, h);
    maxHeight = Math.max(maxHeight, h);
    avgHeight += h;
  }
  avgHeight /= heightmap.length;
  
  const elapsed = Date.now() - regionStartTime;
  console.log(`✅ Region generated in ${elapsed}ms`);
  console.log(`   📊 Cache: ${result.cacheStats.hits} hits, ${result.cacheStats.misses} misses`);
  console.log(`   ⛰️  Height range: ${minHeight.toFixed(1)} to ${maxHeight.toFixed(1)} (avg: ${avgHeight.toFixed(1)})`);

  return regionData;
}

/**
 * GET /api/v2/pipeline
 * Get current world's pipeline
 */
router.get('/pipeline', async (req, res) => {
  try {
    const graph = await loadPipeline();
    res.json({ success: true, pipeline: graph, worldId: WORLD_ID });
  } catch (error) {
    console.error('Error loading pipeline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v2/pipeline
 * Save pipeline to current world
 */
router.post('/pipeline', async (req, res) => {
  try {
    const { nodes, connections, metadata } = req.body;

    const worldDir = path.join(path.dirname(__dirname), '../storage/worlds', WORLD_ID);
    const pipelinePath = path.join(worldDir, 'pipeline.json');

    // Create world directory if it doesn't exist
    await fs.mkdir(worldDir, { recursive: true });

    // Save pipeline
    const pipelineData = {
      nodes,
      connections,
      metadata
    };

    await fs.writeFile(pipelinePath, JSON.stringify(pipelineData, null, 2));

    console.log(`✅ Saved pipeline for world '${WORLD_ID}' (${nodes.length} nodes)`);

    res.json({ success: true, worldId: WORLD_ID, nodeCount: nodes.length });
  } catch (error) {
    console.error('Error saving pipeline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2/info
 * Get current world info
 */
router.get('/info', async (req, res) => {
  try {
    const worldDir = path.join(path.dirname(__dirname), '../storage/worlds', WORLD_ID);
    const configPath = path.join(worldDir, 'config.json');
    
    let config = {};
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(data);
    } catch (err) {
      // No config file
    }

    res.json({
      worldId: WORLD_ID,
      seed: config.seed || 12345,
      name: config.name || WORLD_ID
    });
  } catch (error) {
    console.error('Error getting world info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2/chunks/:x/:y/:z
 * Get a single stream chunk (32x32x32 SVDAG)
 */
router.get('/chunks/:x/:y/:z', async (req, res) => {
  // Wrap entire handler to catch sync GPU errors
  try {
    // No GPU initialization needed - using CPU pipeline
    
    const { x, y, z } = req.params;
    const cx = parseInt(x);
    const cy = parseInt(y);
    const cz = parseInt(z);
    
    // Only log chunks at (0, ?, 0) for debugging
    if (cx === 0 && cz === 0) {
      console.log(`\n📦 V2 Chunk request: ${WORLD_ID} (${cx}, ${cy}, ${cz})`);
    }
    
    // Load world configuration
    const worldDir = path.join(path.dirname(__dirname), '../storage/worlds', WORLD_ID);
    const configPath = path.join(worldDir, 'config.json');
    
    // Check if world exists
    try {
      await fs.access(worldDir);
    } catch {
      return res.status(404).json({ error: 'World not found' });
    }
    
    // Load config
    let config;
    try {
      config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch {
      // console.log('⚠️  No config.json found, using default');
      config = { seed: 12345 };
    }

    const seed = config.seed || 12345;
    
    // Determine which region this chunk belongs to
    const regionX = Math.floor((cx * 32) / 512) * 512;
    const regionZ = Math.floor((cz * 32) / 512) * 512;
    
    // Get or generate region
    const startTime = Date.now();
    const region = await getRegion(regionX, regionZ, seed);
    const regionTime = Date.now() - startTime;
    
    // Generate chunk voxels - FULL TERRAIN
    const chunkStart = Date.now();
    
    const voxels = new Uint32Array(32 * 32 * 32);
    
    // Track if region was cached or generated
    const regionWasCached = regionTime < 1; // < 1ms means it was cached
    
    // COLUMN TEST - 12x12 chunks wide, full height terrain
    let solidCount = 0;
    let airCount = 0;
    
    // if (cx >= -6 && cx <= 5 && cz >= -6 && cz <= 5) {
      // Inside 12x12 column - generate terrain at all Y levels
      for (let voxZ = 0; voxZ < 32; voxZ++) {
        for (let voxX = 0; voxX < 32; voxX++) {
          const worldX = cx * 32 + voxX;
          const worldZ = cz * 32 + voxZ;
          
          const localX = worldX - regionX;
          const localZ = worldZ - regionZ;
          const clampedX = Math.max(0, Math.min(511, localX));
          const clampedZ = Math.max(0, Math.min(511, localZ));
          
          const heightIdx = clampedZ * 512 + clampedX;
          const heightValue = region.heightmap[heightIdx];
          const surfaceHeight = heightValue * 256;
          
          for (let y = 0; y < 32; y++) {
            const worldY = cy * 32 + y;
            const idx = voxZ * 32 * 32 + y * 32 + voxX; // Normal indexing - shader handles flip
            
            if (worldY < surfaceHeight) {
              voxels[idx] = 1; // Grass material
              solidCount++;
            } else {
              voxels[idx] = 0; // Air
              airCount++;
            }
          }
        }
      }
    // } else {
    //   // Outside 12x12 column - all air
    //   airCount = 32 * 32 * 32;
    // }

    // Debug logging disabled - server generation is working correctly
    
    const voxelData = { voxels, solidVoxels: solidCount, airVoxels: airCount };
    
    // Build SVDAG from voxels
    const svdagStart = Date.now();
    const materialSVDAG = svdagBuilder.build(voxels, 32); // 32×32×32 chunk
    const svdagTime = Date.now() - svdagStart;
    
    // For now, opaque SVDAG is same as material SVDAG (no transparent blocks yet)
    const opaqueSVDAG = materialSVDAG;
    
    // Encode chunk data
    const buffer = encodeSVDAGChunk({ materialSVDAG, opaqueSVDAG });
    
    const totalTime = Date.now() - startTime;
    const chunkGenTime = (Date.now() - chunkStart) - svdagTime; // Exclude SVDAG time
    
    // Record metrics with detailed stage timing
    const regionKey = `${regionX}_${regionZ}`;
    const stages = {
      chunkGen: chunkGenTime,
      svdagBuild: svdagTime
    };
    
    // Add region generation timing (only for first chunk in region)
    if (region.timings && !regionWasCached) {
      // Map CPU heightmap generation to "baseElevation" for consistency with GPU pipeline
      stages.baseElevation = region.timings.heightmapGeneration || 0;
      // Note: erosion, upscale, etc. will be added when GPU pipeline is implemented
    }
    
    metrics.recordRequest({
      cx,
      cy,
      cz,
      cached: false, // Chunk itself isn't cached (we always generate SVDAG)
      regionCached: regionWasCached, // But region texture might be cached
      totalTime,
      regionKey,
      chunkSize: buffer.length, // Track network payload size
      stages
    });
    
    // Set headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Chunk-Size', '32');
    res.setHeader('X-Chunk-Position', `${cx},${cy},${cz}`);
    res.setHeader('X-Generation-Time', totalTime.toString());
    res.setHeader('X-Pipeline-Version', 'v2');
    res.setHeader('X-Material-Nodes', materialSVDAG.nodeCount.toString());
    res.setHeader('X-Material-Leaves', materialSVDAG.leafCount.toString());
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ Error generating V2 chunk:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'V2 chunk generation failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/v2/worlds/:worldId/invalidate-region
 * Invalidate cached region
 */
router.post('/worlds/:worldId/invalidate-region', async (req, res) => {
  const { worldId } = req.params;
  const { regionX, regionZ } = req.body;
  
  // Load seed
  const worldDir = path.join('storage', 'worlds', worldId);
  const configPath = path.join(worldDir, 'config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  const seed = config.seed || 12345;
  
  const regionKey = `${regionX}_${regionZ}_${seed}`;
  
  if (regionCache.has(regionKey)) {
    regionCache.delete(regionKey);
    console.log(`🗑️  Invalidated region: (${regionX}, ${regionZ})`);
    res.json({ success: true, message: 'Region invalidated' });
  } else {
    res.json({ success: false, message: 'Region not in cache' });
  }
});

/**
 * Helper: Encode SVDAG chunk to binary (V1-compatible format)
 */
function encodeSVDAGChunk(chunk) {
  const { materialSVDAG, opaqueSVDAG } = chunk;

  // Calculate buffer size (40-byte header + data)
  const headerSize = 40;
  const materialNodesSize = materialSVDAG.nodesBuffer.byteLength;
  const materialLeavesSize = materialSVDAG.leavesBuffer.byteLength;
  const opaqueNodesSize = opaqueSVDAG.nodesBuffer.byteLength;
  const opaqueLeavesSize = opaqueSVDAG.leavesBuffer.byteLength;

  const totalSize = headerSize + materialNodesSize + materialLeavesSize + 
                   opaqueNodesSize + opaqueLeavesSize;

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Write 40-byte header (V1-compatible)
  buffer.writeUInt32LE(0x53564441, offset); offset += 4; // Magic: 'SVDA'
  buffer.writeUInt32LE(2, offset); offset += 4;          // Version 2 (dual SVDAG)
  buffer.writeUInt32LE(32, offset); offset += 4;         // Chunk size
  buffer.writeUInt32LE(materialSVDAG.nodeCount, offset); offset += 4;
  buffer.writeUInt32LE(materialSVDAG.leafCount, offset); offset += 4;
  buffer.writeUInt32LE(materialSVDAG.rootIdx, offset); offset += 4;
  buffer.writeUInt32LE(0, offset); offset += 4;          // Flags (reserved)
  buffer.writeUInt32LE(0, offset); offset += 4;          // Checksum (not implemented)
  buffer.writeUInt32LE(opaqueSVDAG.rootIdx, offset); offset += 4;
  buffer.writeUInt32LE(opaqueSVDAG.nodeCount, offset); offset += 4;

  // Write material SVDAG nodes
  const matNodesBuffer = Buffer.from(materialSVDAG.nodesBuffer.buffer);
  matNodesBuffer.copy(buffer, offset);
  offset += materialNodesSize;

  // Write material SVDAG leaves
  const matLeavesBuffer = Buffer.from(materialSVDAG.leavesBuffer.buffer);
  matLeavesBuffer.copy(buffer, offset);
  offset += materialLeavesSize;

  // Write opaque SVDAG nodes
  const opqNodesBuffer = Buffer.from(opaqueSVDAG.nodesBuffer.buffer);
  opqNodesBuffer.copy(buffer, offset);
  offset += opaqueNodesSize;

  // Write opaque SVDAG leaves
  const opqLeavesBuffer = Buffer.from(opaqueSVDAG.leavesBuffer.buffer);
  opqLeavesBuffer.copy(buffer, offset);

  return buffer;
}

export default router;
