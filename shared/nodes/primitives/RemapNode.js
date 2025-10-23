/**
 * RemapNode - Scales values from one range to another
 * Category: Primitive
 * Inputs: 1 (input)
 * Outputs: 1 (output)
 */

import { BaseNode } from '../BaseNode.js';

export class RemapNode extends BaseNode {
  static type = 'Remap';
  static category = 'Primitives';
  static displayName = 'Remap';
  static description = 'Remaps values from one range to another';
  
  static inputs = ['input'];
  static outputs = ['output'];
  
  static params = {
    inputMin: {
      type: 'number',
      default: 0.0,
      min: -10,
      max: 10,
      step: 0.1,
      description: 'Input range minimum'
    },
    inputMax: {
      type: 'number',
      default: 1.0,
      min: -10,
      max: 10,
      step: 0.1,
      description: 'Input range maximum'
    },
    outputMin: {
      type: 'number',
      default: 0.0,
      min: -10,
      max: 10,
      step: 0.1,
      description: 'Output range minimum'
    },
    outputMax: {
      type: 'number',
      default: 1.0,
      min: -10,
      max: 10,
      step: 0.1,
      description: 'Output range maximum'
    }
  };

  async execute(inputs, params) {
    const { input } = inputs;
    const { inputMin = 0.0, inputMax = 1.0, outputMin = 0.0, outputMax = 1.0 } = params;

    if (!input) {
      throw new Error('RemapNode requires input');
    }

    const output = new Float32Array(input.length);
    const inputRange = inputMax - inputMin;
    const outputRange = outputMax - outputMin;

    if (inputRange === 0) {
      // Avoid division by zero
      output.fill(outputMin);
      return { output };
    }

    for (let i = 0; i < input.length; i++) {
      // Normalize to [0,1]
      const normalized = (input[i] - inputMin) / inputRange;
      // Remap to output range
      const remapped = normalized * outputRange + outputMin;
      // Clamp to output range
      output[i] = Math.max(outputMin, Math.min(outputMax, remapped));
    }

    return { output };
  }
}
