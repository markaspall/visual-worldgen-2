/**
 * BlendNode - Combines two inputs using various operations
 * Category: Primitive
 * Inputs: 2 (input1, input2)
 * Outputs: 1 (output)
 */

import { BaseNode } from '../BaseNode.js';

export class BlendNode extends BaseNode {
  static type = 'Blend';
  static category = 'Primitives';
  static displayName = 'Blend';
  static description = 'Combines two inputs using various blend operations';
  
  static inputs = ['input1', 'input2'];
  static outputs = ['output'];
  
  static params = {
    operation: {
      type: 'select',
      default: 'add',
      options: ['add', 'subtract', 'multiply', 'lerp', 'min', 'max', 'overlay'],
      description: 'Blend operation'
    },
    weight: {
      type: 'number',
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Blend weight (for lerp and overlay)'
    }
  };

  async execute(inputs, params) {
    const { input1, input2 } = inputs;
    const { operation = 'add', weight = 0.5 } = params;

    if (!input1 || !input2) {
      throw new Error('BlendNode requires both input1 and input2');
    }

    if (input1.length !== input2.length) {
      throw new Error('Inputs must have same length');
    }

    const output = new Float32Array(input1.length);

    // Perform blend operation (CPU)
    for (let i = 0; i < output.length; i++) {
      const a = input1[i];
      const b = input2[i];

      switch (operation) {
        case 'add':
          output[i] = a + b;
          break;
        case 'subtract':
          output[i] = a - b;
          break;
        case 'multiply':
          output[i] = a * b;
          break;
        case 'lerp':
          output[i] = a * (1 - weight) + b * weight;
          break;
        case 'min':
          output[i] = Math.min(a, b);
          break;
        case 'max':
          output[i] = Math.max(a, b);
          break;
        case 'overlay':
          // Overlay blend mode: darker if a < 0.5, lighter if a > 0.5
          output[i] = a < 0.5
            ? 2 * a * b
            : 1 - 2 * (1 - a) * (1 - b);
          output[i] = output[i] * weight + a * (1 - weight);
          break;
        default:
          output[i] = a + b;
      }
    }

    return { output };
  }
}
