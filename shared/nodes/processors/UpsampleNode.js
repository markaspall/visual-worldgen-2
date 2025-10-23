/**
 * UpsampleNode - Increases resolution with interpolation
 * Category: Processor
 * Inputs: 1 (input)
 * Outputs: 1 (output)
 */

import { BaseNode } from '../BaseNode.js';

export class UpsampleNode extends BaseNode {
  static type = 'Upsample';
  static category = 'Processors';
  static displayName = 'Upsample';
  static description = 'Increases resolution using bicubic interpolation';
  
  static inputs = ['input'];
  static outputs = ['output'];
  
  static params = {
    inputResolution: {
      type: 'number',
      default: 256,
      min: 64,
      max: 2048,
      step: 64,
      description: 'Input resolution'
    },
    outputResolution: {
      type: 'number',
      default: 512,
      min: 64,
      max: 2048,
      step: 64,
      description: 'Output resolution (higher = more detail)'
    }
  };

  async execute(inputs, params) {
    const { input } = inputs;
    let { inputResolution, outputResolution = 512 } = params;

    if (!input) {
      throw new Error('UpsampleNode requires input');
    }

    // Auto-detect input resolution if not provided
    if (!inputResolution) {
      inputResolution = Math.sqrt(input.length);
      if (inputResolution % 1 !== 0) {
        throw new Error(`Input size ${input.length} is not a perfect square`);
      }
    }

    // Validate input size matches expected
    if (input.length !== inputResolution * inputResolution) {
      // Auto-correct if input is different
      inputResolution = Math.sqrt(input.length);
      if (inputResolution % 1 !== 0) {
        throw new Error(`Input size ${input.length} is not a perfect square`);
      }
    }

    const output = new Float32Array(outputResolution * outputResolution);
    const scale = inputResolution / outputResolution;

    // Bicubic-like upsampling with multi-tap filtering
    for (let y = 0; y < outputResolution; y++) {
      for (let x = 0; x < outputResolution; x++) {
        // Map to input coordinates (center of pixel)
        const srcX = (x + 0.5) * scale - 0.5;
        const srcY = (y + 0.5) * scale - 0.5;
        
        // Get center pixel
        const cx = Math.floor(srcX + 0.5);
        const cy = Math.floor(srcY + 0.5);
        
        // Sample 3x3 neighborhood for better quality
        let sum = 0;
        let weightSum = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const sx = Math.max(0, Math.min(inputResolution - 1, cx + dx));
            const sy = Math.max(0, Math.min(inputResolution - 1, cy + dy));
            
            // Distance-based weight (Gaussian-like)
            const distX = srcX - sx;
            const distY = srcY - sy;
            const dist = Math.sqrt(distX * distX + distY * distY);
            const weight = Math.exp(-dist * dist * 2); // Gaussian falloff
            
            const value = input[sy * inputResolution + sx] || 0;
            sum += value * weight;
            weightSum += weight;
          }
        }
        
        output[y * outputResolution + x] = weightSum > 0 ? sum / weightSum : 0;
      }
    }

    // Apply smoothing pass to remove remaining artifacts
    const smoothed = this.smoothPass(output, outputResolution);

    return { output: smoothed };
  }

  /**
   * Apply a smoothing pass to reduce artifacts
   */
  smoothPass(data, resolution) {
    const result = new Float32Array(data.length);
    
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        let sum = 0;
        let count = 0;
        
        // 3x3 box filter
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < resolution && ny >= 0 && ny < resolution) {
              sum += data[ny * resolution + nx];
              count++;
            }
          }
        }
        
        result[y * resolution + x] = sum / count;
      }
    }
    
    return result;
  }
}
