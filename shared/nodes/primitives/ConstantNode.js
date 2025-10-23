/**
 * ConstantNode - Outputs a constant value
 * Category: Primitive
 * Inputs: 0
 * Outputs: 1 (output)
 */

import { BaseNode } from '../BaseNode.js';

export class ConstantNode extends BaseNode {
  static type = 'Constant';
  static category = 'Primitives';
  static displayName = 'Constant';
  static description = 'Outputs a constant value across entire map';
  
  static inputs = [];
  static outputs = ['output'];
  
  static params = {
    value: {
      type: 'number',
      default: 0.5,
      min: -10,
      max: 10,
      step: 0.1,
      description: 'Constant value to output'
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
    const { value = 0.5, resolution = 512 } = params;

    const output = new Float32Array(resolution * resolution);
    output.fill(value);

    return { output };
  }
}
