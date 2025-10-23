/**
 * DownsampleNode - Reduces resolution for faster processing
 * Category: Processor
 * Inputs: 1 (input)
 * Outputs: 1 (output)
 */

import { BaseNode } from '../BaseNode.js';

export class DownsampleNode extends BaseNode {
  static type = 'Downsample';
  static category = 'Processors';
  static displayName = 'Downsample';
  static description = 'Reduces resolution using bilinear averaging (for faster erosion)';
  
  static inputs = ['input'];
  static outputs = ['output'];
  
  static params = {
    inputResolution: {
      type: 'number',
      default: 512,
      min: 64,
      max: 2048,
      step: 64,
      description: 'Input resolution'
    },
    outputResolution: {
      type: 'number',
      default: 256,
      min: 64,
      max: 2048,
      step: 64,
      description: 'Output resolution (lower = faster)'
    }
  };

  async execute(inputs, params) {
    const { input } = inputs;
    let { inputResolution, outputResolution = 256 } = params;

    if (!input) {
      throw new Error('DownsampleNode requires input');
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

    // Bilinear downsampling
    for (let y = 0; y < outputResolution; y++) {
      for (let x = 0; x < outputResolution; x++) {
        // Map to input coordinates
        const srcX = x * scale;
        const srcY = y * scale;
        
        // Sample area average
        let sum = 0;
        let count = 0;
        
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + Math.ceil(scale), inputResolution - 1);
        const y1 = Math.min(y0 + Math.ceil(scale), inputResolution - 1);
        
        for (let sy = y0; sy <= y1; sy++) {
          for (let sx = x0; sx <= x1; sx++) {
            sum += input[sy * inputResolution + sx];
            count++;
          }
        }
        
        output[y * outputResolution + x] = sum / count;
      }
    }

    return { output };
  }
}
