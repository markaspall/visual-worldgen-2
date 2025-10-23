/**
 * BiomeClassifierNode - Classifies terrain into biomes (GPU-accelerated)
 * Category: Processor
 * Inputs: 3 (elevation, temperature, moisture)
 * Outputs: 2 (biomeIds, visualization)
 */

import { BaseNode } from '../BaseNode.js';

export class BiomeClassifierNode extends BaseNode {
  static type = 'BiomeClassifier';
  static category = 'Processors';
  static displayName = 'Biome Classifier';
  static description = 'Classifies terrain into biomes based on elevation, temperature, and moisture';
  
  static inputs = ['elevation', 'temperature', 'moisture'];
  static outputs = ['biomeIds', 'visualization'];
  
  static params = {
    resolution: {
      type: 'number',
      default: 512,
      min: 64,
      max: 2048,
      step: 64,
      description: 'Map resolution'
    },
    biomes: {
      type: 'array',
      default: [
        // Ocean biomes
        { id: 0, name: 'Deep Ocean', color: '#0A2463', elevation: [0, 0.3], temperature: null, moisture: null },
        { id: 1, name: 'Ocean', color: '#1E40AF', elevation: [0.3, 0.4], temperature: null, moisture: null },
        
        // Coastal
        { id: 2, name: 'Beach', color: '#FDE68A', elevation: [0.4, 0.45], temperature: [0.3, 1.0], moisture: null },
        
        // Hot biomes
        { id: 3, name: 'Desert', color: '#F59E0B', elevation: [0.45, 1.0], temperature: [0.6, 1.0], moisture: [0, 0.25] },
        { id: 4, name: 'Savanna', color: '#D97706', elevation: [0.45, 0.7], temperature: [0.5, 0.9], moisture: [0.25, 0.45] },
        
        // Temperate biomes
        { id: 5, name: 'Grassland', color: '#84CC16', elevation: [0.45, 0.7], temperature: [0.4, 0.7], moisture: [0.3, 0.6] },
        { id: 6, name: 'Temperate Forest', color: '#059669', elevation: [0.45, 0.7], temperature: [0.3, 0.6], moisture: [0.5, 0.8] },
        
        // Tropical
        { id: 7, name: 'Tropical Forest', color: '#15803D', elevation: [0.45, 0.7], temperature: [0.7, 1.0], moisture: [0.6, 1.0] },
        
        // Cold biomes
        { id: 8, name: 'Taiga', color: '#064E3B', elevation: [0.45, 0.8], temperature: [0.1, 0.4], moisture: [0.4, 0.7] },
        { id: 9, name: 'Tundra', color: '#9CA3AF', elevation: [0.45, 0.8], temperature: [0, 0.2], moisture: null },
        
        // Mountain biomes
        { id: 10, name: 'Rocky Mountain', color: '#78716C', elevation: [0.7, 0.85], temperature: [0.2, 0.6], moisture: null },
        { id: 11, name: 'Snow Peak', color: '#F3F4F6', elevation: [0.8, 1.0], temperature: null, moisture: null },
        { id: 12, name: 'Alpine', color: '#E5E7EB', elevation: [0.7, 1.0], temperature: [0, 0.3], moisture: null }
      ],
      description: 'Biome definitions'
    }
  };

  async execute(inputs, params) {
    const { elevation, temperature, moisture } = inputs;
    let { resolution, biomes = BiomeClassifierNode.params.biomes.default } = params;

    if (!elevation || !temperature || !moisture) {
      throw new Error('BiomeClassifier requires elevation, temperature, and moisture inputs');
    }

    // Auto-detect resolution from inputs
    if (!resolution) {
      resolution = Math.sqrt(elevation.length);
    }

    // Handle input size mismatches by resampling smaller inputs
    let targetSize = Math.max(elevation.length, temperature.length, moisture.length);
    let targetResolution = Math.sqrt(targetSize);
    
    // Resample inputs to match largest resolution
    const resampledElevation = this.resampleToSize(elevation, targetResolution);
    const resampledTemperature = this.resampleToSize(temperature, targetResolution);
    const resampledMoisture = this.resampleToSize(moisture, targetResolution);
    
    const size = targetSize;
    resolution = targetResolution;

    // CPU-based classification (GPU version coming soon)
    const biomeIds = new Uint8Array(size);
    const visualization = new Uint8ClampedArray(size * 4); // RGBA

    for (let i = 0; i < size; i++) {
      const e = resampledElevation[i];
      const t = resampledTemperature[i];
      const m = resampledMoisture[i];

      // Find best matching biome
      const biomeId = this.classifyPixel(e, t, m, biomes);
      biomeIds[i] = biomeId;

      // Get biome color
      const biome = biomes[biomeId];
      const color = this.hexToRgb(biome.color);
      
      visualization[i * 4] = color.r;
      visualization[i * 4 + 1] = color.g;
      visualization[i * 4 + 2] = color.b;
      visualization[i * 4 + 3] = 255;
    }

    return {
      biomeIds,
      visualization
    };
  }

  /**
   * Classify a single pixel
   * Uses "most specific wins" logic - biome with most matching thresholds wins
   */
  classifyPixel(elevation, temperature, moisture, biomes) {
    let bestBiome = 0;
    let bestSpecificity = -1;

    for (let i = 0; i < biomes.length; i++) {
      const biome = biomes[i];
      let matches = true;
      let specificity = 0;

      // Check elevation threshold
      if (biome.elevation) {
        if (elevation < biome.elevation[0] || elevation > biome.elevation[1]) {
          matches = false;
        } else {
          specificity++;
        }
      }

      // Check temperature threshold
      if (biome.temperature) {
        if (temperature < biome.temperature[0] || temperature > biome.temperature[1]) {
          matches = false;
        } else {
          specificity++;
        }
      }

      // Check moisture threshold
      if (biome.moisture) {
        if (moisture < biome.moisture[0] || moisture > biome.moisture[1]) {
          matches = false;
        } else {
          specificity++;
        }
      }

      // If matches and more specific than current best, use it
      if (matches && specificity > bestSpecificity) {
        bestBiome = i;
        bestSpecificity = specificity;
      }
    }

    return bestBiome;
  }

  /**
   * Resample data to target resolution (bilinear interpolation for smooth results)
   */
  resampleToSize(data, targetResolution) {
    const sourceResolution = Math.sqrt(data.length);
    
    // If already at target size, return as-is
    if (sourceResolution === targetResolution) {
      return data;
    }
    
    const targetSize = targetResolution * targetResolution;
    const result = new Float32Array(targetSize);
    const scale = sourceResolution / targetResolution;
    
    for (let y = 0; y < targetResolution; y++) {
      for (let x = 0; x < targetResolution; x++) {
        // Map to source coordinates (center of pixel)
        const srcX = (x + 0.5) * scale - 0.5;
        const srcY = (y + 0.5) * scale - 0.5;
        
        // Bilinear interpolation
        const x0 = Math.max(0, Math.floor(srcX));
        const y0 = Math.max(0, Math.floor(srcY));
        const x1 = Math.min(x0 + 1, sourceResolution - 1);
        const y1 = Math.min(y0 + 1, sourceResolution - 1);
        
        const fx = Math.max(0, Math.min(1, srcX - x0));
        const fy = Math.max(0, Math.min(1, srcY - y0));
        
        // Sample 4 pixels
        const v00 = data[y0 * sourceResolution + x0] || 0;
        const v10 = data[y0 * sourceResolution + x1] || 0;
        const v01 = data[y1 * sourceResolution + x0] || 0;
        const v11 = data[y1 * sourceResolution + x1] || 0;
        
        // Bilinear interpolation
        const v0 = v00 * (1 - fx) + v10 * fx;
        const v1 = v01 * (1 - fx) + v11 * fx;
        const value = v0 * (1 - fy) + v1 * fy;
        
        result[y * targetResolution + x] = value;
      }
    }
    
    return result;
  }

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 128, g: 128, b: 128 };
  }
}
