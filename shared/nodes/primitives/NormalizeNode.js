/**
 * NormalizeNode - Normalizes input to [0,1] range
 * Category: Primitive
 * Inputs: 1 (input)
 * Outputs: 1 (output)
 */

import { BaseNode } from '../BaseNode.js';

export class NormalizeNode extends BaseNode {
  static type = 'Normalize';
  static category = 'Primitives';
  static displayName = 'Normalize';
  static description = 'Normalizes values to [0,1] range based on min/max';
  
  static inputs = ['input'];
  static outputs = ['output'];
  
  static params = {
    method: {
      type: 'select',
      default: 'minmax',
      options: ['minmax', 'clamp'],
      description: 'Normalization method'
    }
  };

  async execute(inputs, params) {
    const { input } = inputs;
    const { method = 'minmax' } = params;

    if (!input) {
      throw new Error('NormalizeNode requires input');
    }

    const output = new Float32Array(input.length);

    if (method === 'minmax') {
      // Find min and max
      let min = Infinity;
      let max = -Infinity;
      
      for (let i = 0; i < input.length; i++) {
        if (input[i] < min) min = input[i];
        if (input[i] > max) max = input[i];
      }

      const range = max - min;
      
      if (range === 0) {
        // All values the same
        output.fill(0.5);
      } else {
        // Normalize to [0, 1]
        for (let i = 0; i < input.length; i++) {
          output[i] = (input[i] - min) / range;
        }
      }
    } else if (method === 'clamp') {
      // Just clamp to [0, 1]
      for (let i = 0; i < input.length; i++) {
        output[i] = Math.max(0, Math.min(1, input[i]));
      }
    }

    return { output };
  }
}
