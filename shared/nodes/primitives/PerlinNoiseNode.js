/**
 * PerlinNoiseNode - Primitive noise generator
 * Generic Perlin noise that can be reused for elevation, moisture, temperature, etc.
 */

import { BaseNode } from '../BaseNode.js';

export class PerlinNoiseNode extends BaseNode {
  static type = 'PerlinNoise';
  static category = 'Primitives';
  static displayName = 'Perlin Noise';
  static description = 'Multi-octave Perlin noise generator';
  
  static inputs = [];  // No inputs - pure generator
  static outputs = ['noise'];
  
  static params = {
    frequency: { type: 'number', default: 0.001, min: 0.0001, max: 0.1, step: 0.0001 },
    octaves: { type: 'integer', default: 4, min: 1, max: 8 },
    persistence: { type: 'number', default: 0.5, min: 0, max: 1, step: 0.1 },
    lacunarity: { type: 'number', default: 2.0, min: 1, max: 4, step: 0.1 },
    amplitude: { type: 'number', default: 1.0, min: 0, max: 2, step: 0.1 },
    offsetX: { type: 'number', default: 0, min: -10000, max: 10000 },
    offsetZ: { type: 'number', default: 0, min: -10000, max: 10000 },
    seed: { type: 'integer', default: 12345, min: 0, max: 999999 }
  };
  
  static cacheable = true;
  static cacheKeyParams = ['frequency', 'octaves', 'persistence', 'lacunarity', 'amplitude', 'seed'];

  async execute(inputs, params) {
    // Extract parameters with defaults
    const {
      frequency = 0.001,
      octaves = 4,
      persistence = 0.5,
      lacunarity = 2.0,
      amplitude = 1.0,
      offsetX = 0,
      offsetZ = 0,
      seed = 12345,
      resolution = 512  // Output resolution (from GraphExecutor)
    } = params;

    // Generate noise on CPU (works everywhere)
    const noiseData = this.generatePerlinNoise(
      resolution,
      frequency,
      octaves,
      persistence,
      lacunarity,
      amplitude,
      offsetX,
      offsetZ,
      seed
    );

    return {
      noise: noiseData
    };
  }

  /**
   * Generate multi-octave Perlin noise
   */
  generatePerlinNoise(resolution, frequency, octaves, persistence, lacunarity, amplitude, offsetX, offsetZ, seed) {
    const size = resolution * resolution;
    const output = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const x = (i % resolution) + offsetX;
      const z = Math.floor(i / resolution) + offsetZ;
      
      let value = 0;
      let freq = frequency;
      let amp = amplitude;
      let maxValue = 0;

      for (let octave = 0; octave < octaves; octave++) {
        value += this.samplePerlin(x * freq, z * freq, seed + octave) * amp;
        maxValue += amp;
        
        freq *= lacunarity;
        amp *= persistence;
      }

      // Normalize to [-1, 1] then to [0, 1]
      output[i] = (value / maxValue) * 0.5 + 0.5;
    }

    return output;
  }

  /**
   * Sample single Perlin noise value
   * Classic Perlin noise implementation
   */
  samplePerlin(x, z, seed) {
    // Grid coordinates
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const z1 = z0 + 1;

    // Local coordinates [0, 1]
    const fx = x - x0;
    const fz = z - z0;

    // Fade curves (smoothstep)
    const u = this.fade(fx);
    const v = this.fade(fz);

    // Gradients at corners
    const g00 = this.gradient(x0, z0, seed);
    const g10 = this.gradient(x1, z0, seed);
    const g01 = this.gradient(x0, z1, seed);
    const g11 = this.gradient(x1, z1, seed);

    // Dot products
    const d00 = this.dot2D(g00, fx, fz);
    const d10 = this.dot2D(g10, fx - 1, fz);
    const d01 = this.dot2D(g01, fx, fz - 1);
    const d11 = this.dot2D(g11, fx - 1, fz - 1);

    // Bilinear interpolation
    const i0 = this.lerp(d00, d10, u);
    const i1 = this.lerp(d01, d11, u);
    
    return this.lerp(i0, i1, v);
  }

  /**
   * Fade function (6t^5 - 15t^4 + 10t^3)
   */
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Linear interpolation
   */
  lerp(a, b, t) {
    return a + t * (b - a);
  }

  /**
   * 2D dot product
   */
  dot2D(gradient, x, z) {
    return gradient[0] * x + gradient[1] * z;
  }

  /**
   * Get gradient vector at grid point
   */
  gradient(x, z, seed) {
    // Hash grid coordinates
    const h = this.hash2D(x, z, seed);
    
    // Convert to angle (8 directions)
    const angle = (h & 7) * Math.PI / 4;
    
    return [Math.cos(angle), Math.sin(angle)];
  }

  /**
   * 2D hash function
   */
  hash2D(x, z, seed) {
    let h = seed + x * 374761393 + z * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return h & 0x7FFFFFFF; // Keep positive
  }
}
