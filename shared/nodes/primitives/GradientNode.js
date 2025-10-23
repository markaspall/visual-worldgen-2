/**
 * GradientNode - Generates gradient based on coordinates
 * Category: Primitive
 * Inputs: 0 (generates gradient from coordinates)
 * Outputs: 1 (output)
 */

import { BaseNode } from '../BaseNode.js';

export class GradientNode extends BaseNode {
  static type = 'Gradient';
  static category = 'Primitives';
  static displayName = 'Gradient';
  static description = 'Generates a gradient based on coordinates (useful for temperature)';
  
  static inputs = [];
  static outputs = ['output'];
  
  static params = {
    direction: {
      type: 'select',
      default: 'vertical',
      options: ['vertical', 'horizontal', 'radial', 'diagonal'],
      description: 'Gradient direction'
    },
    invert: {
      type: 'boolean',
      default: false,
      description: 'Invert gradient'
    },
    resolution: {
      type: 'number',
      default: 512,
      min: 64,
      max: 2048,
      step: 64,
      description: 'Output resolution'
    }
  };

  async execute(inputs, params) {
    const { direction = 'vertical', invert = false, resolution = 512 } = params;

    const output = new Float32Array(resolution * resolution);

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const idx = y * resolution + x;
        
        // Normalized coordinates [0, 1]
        const nx = x / (resolution - 1);
        const ny = y / (resolution - 1);

        let value = 0;

        switch (direction) {
          case 'vertical':
            // Top to bottom
            value = ny;
            break;
            
          case 'horizontal':
            // Left to right
            value = nx;
            break;
            
          case 'radial':
            // Center to edges
            const cx = nx - 0.5;
            const cy = ny - 0.5;
            const dist = Math.sqrt(cx * cx + cy * cy);
            value = Math.min(1, dist * 2); // Normalize to [0,1]
            break;
            
          case 'diagonal':
            // Corner to corner
            value = (nx + ny) / 2;
            break;
            
          default:
            value = ny;
        }

        output[idx] = invert ? (1 - value) : value;
      }
    }

    return { output };
  }
}
