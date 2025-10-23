/**
 * ElevationOutputNode - Marks elevation data as final output for world generation
 * Category: Outputs
 * Inputs: 1 (elevation)
 * Outputs: 1 (elevation passthrough)
 */

import { BaseNode } from '../BaseNode.js';

export class ElevationOutputNode extends BaseNode {
  static type = 'ElevationOutput';
  static category = 'Outputs';
  static displayName = '🎯 Elevation Output';
  static description = 'Final elevation output for world generation (heightmap)';
  
  static inputs = ['elevation'];
  static outputs = ['elevation'];  // Pass through
  
  static params = {
    // No parameters needed - just marks the data as output
  };

  async execute(inputs, params) {
    const { elevation } = inputs;

    if (!elevation) {
      throw new Error('ElevationOutput requires elevation input');
    }

    // Just pass through - this node is a marker for the system
    return {
      elevation: elevation
    };
  }
}
