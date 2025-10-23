/**
 * HydraulicErosionNode - Particle-based hydraulic erosion
 * Category: Processor
 * Inputs: 2 (elevation, moisture)
 * Outputs: 2 (elevation, sediment)
 */

import { BaseNode } from '../BaseNode.js';

export class HydraulicErosionNode extends BaseNode {
  static type = 'HydraulicErosion';
  static category = 'Processors';
  static displayName = 'Hydraulic Erosion';
  static description = 'Simulates water erosion using particle-based physics';
  
  static inputs = ['elevation', 'moisture'];
  static outputs = ['elevation', 'sediment'];
  
  static params = {
    resolution: {
      type: 'number',
      default: 256,
      min: 64,
      max: 1024,
      step: 64,
      description: 'Map resolution'
    },
    iterations: {
      type: 'number',
      default: 20,
      min: 1,
      max: 50,
      step: 1,
      description: 'Number of erosion iterations'
    },
    particlesPerIteration: {
      type: 'number',
      default: 2500,
      min: 100,
      max: 10000,
      step: 100,
      description: 'Particles spawned per iteration'
    },
    erosionRate: {
      type: 'number',
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'How much terrain is eroded per step'
    },
    depositionRate: {
      type: 'number',
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'How much sediment is deposited per step'
    },
    evaporationRate: {
      type: 'number',
      default: 0.02,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: 'Water evaporation per step (higher = shorter flow)'
    },
    gravity: {
      type: 'number',
      default: 4.0,
      min: 0.1,
      max: 10,
      step: 0.1,
      description: 'Gravity strength'
    },
    maxLifetime: {
      type: 'number',
      default: 30,
      min: 10,
      max: 100,
      step: 5,
      description: 'Maximum steps per particle'
    }
  };

  async execute(inputs, params) {
    const { elevation, moisture } = inputs;
    const {
      resolution = 256,
      iterations = 20,
      particlesPerIteration = 2500,
      erosionRate = 0.3,
      depositionRate = 0.3,
      evaporationRate = 0.02,
      gravity = 4.0,
      maxLifetime = 30
    } = params;

    if (!elevation) {
      throw new Error('HydraulicErosion requires elevation input');
    }

    // Clone elevation data (we'll modify it)
    const erodedElevation = new Float32Array(elevation);
    const sediment = new Float32Array(resolution * resolution);

    // Use moisture if available, otherwise assume uniform
    const moistureMap = moisture || new Float32Array(resolution * resolution).fill(0.5);

    // Run erosion iterations
    for (let iter = 0; iter < iterations; iter++) {
      for (let p = 0; p < particlesPerIteration; p++) {
        this.simulateParticle(
          erodedElevation,
          sediment,
          moistureMap,
          resolution,
          erosionRate,
          depositionRate,
          evaporationRate,
          gravity,
          maxLifetime
        );
      }
    }

    return {
      elevation: erodedElevation,
      sediment: sediment
    };
  }

  /**
   * Simulate a single erosion particle
   */
  simulateParticle(elevation, sediment, moisture, resolution, erosionRate, depositionRate, evaporationRate, gravity, maxLifetime) {
    // Random starting position
    let x = Math.random() * (resolution - 1);
    let y = Math.random() * (resolution - 1);
    
    let vx = 0;
    let vy = 0;
    let water = 1.0;
    let sedimentCarried = 0;
    
    for (let lifetime = 0; lifetime < maxLifetime; lifetime++) {
      // Get current cell
      const cellX = Math.floor(x);
      const cellY = Math.floor(y);
      
      if (cellX < 0 || cellX >= resolution - 1 || cellY < 0 || cellY >= resolution - 1) {
        break; // Particle left map
      }
      
      const cellIndex = cellY * resolution + cellX;
      
      // Calculate gradient (using bilinear sampling)
      const gradient = this.calculateGradient(elevation, resolution, x, y);
      
      // Update velocity (gravity pulls down gradient)
      vx += gradient.x * gravity;
      vy += gradient.y * gravity;
      
      // Move particle
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > 0) {
        vx /= speed;
        vy /= speed;
      }
      
      const moveDistance = Math.min(speed, 1.0);
      x += vx * moveDistance;
      y += vy * moveDistance;
      
      // Check bounds again
      if (x < 0 || x >= resolution - 1 || y < 0 || y >= resolution - 1) {
        break;
      }
      
      // Calculate sediment capacity (faster water = more capacity)
      const height = this.sampleBilinear(elevation, resolution, x, y);
      const capacity = Math.max(0, speed * water * 4.0);
      
      // Get moisture at this location (affects erosion rate)
      const localMoisture = this.sampleBilinear(moisture, resolution, x, y);
      const moistureMultiplier = 0.5 + localMoisture * 0.5; // [0.5, 1.0] range
      
      if (sedimentCarried > capacity) {
        // Deposit sediment
        const amountToDeposit = (sedimentCarried - capacity) * depositionRate;
        sedimentCarried -= amountToDeposit;
        this.depositAt(sediment, resolution, x, y, amountToDeposit);
        this.depositAt(elevation, resolution, x, y, amountToDeposit);
      } else {
        // Erode terrain
        const amountToErode = Math.min(
          (capacity - sedimentCarried) * erosionRate * moistureMultiplier,
          -gradient.z * 0.1 // Limit erosion on steep slopes
        );
        
        sedimentCarried += amountToErode;
        this.depositAt(elevation, resolution, x, y, -amountToErode);
      }
      
      // Evaporate water
      water *= (1 - evaporationRate);
      
      if (water < 0.01) {
        // Particle dried up, deposit remaining sediment
        this.depositAt(sediment, resolution, x, y, sedimentCarried);
        this.depositAt(elevation, resolution, x, y, sedimentCarried);
        break;
      }
      
      // Dampen velocity
      vx *= 0.9;
      vy *= 0.9;
    }
  }

  /**
   * Calculate gradient at position using bilinear sampling
   */
  calculateGradient(data, resolution, x, y) {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    
    if (cellX < 1 || cellX >= resolution - 2 || cellY < 1 || cellY >= resolution - 2) {
      return { x: 0, y: 0, z: 0 };
    }
    
    // Sample heights around position
    const h = this.sampleBilinear(data, resolution, x, y);
    const hL = this.sampleBilinear(data, resolution, x - 1, y);
    const hR = this.sampleBilinear(data, resolution, x + 1, y);
    const hD = this.sampleBilinear(data, resolution, x, y - 1);
    const hU = this.sampleBilinear(data, resolution, x, y + 1);
    
    // Gradient points downhill
    return {
      x: (hL - hR) * 0.5,
      y: (hD - hU) * 0.5,
      z: Math.max(Math.abs(hL - hR), Math.abs(hD - hU))
    };
  }

  /**
   * Bilinear sampling
   */
  sampleBilinear(data, resolution, x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, resolution - 1);
    const y1 = Math.min(y0 + 1, resolution - 1);
    
    const fx = x - x0;
    const fy = y - y0;
    
    const v00 = data[y0 * resolution + x0] || 0;
    const v10 = data[y0 * resolution + x1] || 0;
    const v01 = data[y1 * resolution + x0] || 0;
    const v11 = data[y1 * resolution + x1] || 0;
    
    const v0 = v00 * (1 - fx) + v10 * fx;
    const v1 = v01 * (1 - fx) + v11 * fx;
    
    return v0 * (1 - fy) + v1 * fy;
  }

  /**
   * Deposit material at position (bilinear distribution)
   */
  depositAt(data, resolution, x, y, amount) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, resolution - 1);
    const y1 = Math.min(y0 + 1, resolution - 1);
    
    const fx = x - x0;
    const fy = y - y0;
    
    // Distribute amount to 4 nearest cells
    data[y0 * resolution + x0] += amount * (1 - fx) * (1 - fy);
    data[y0 * resolution + x1] += amount * fx * (1 - fy);
    data[y1 * resolution + x0] += amount * (1 - fx) * fy;
    data[y1 * resolution + x1] += amount * fx * fy;
  }
}
