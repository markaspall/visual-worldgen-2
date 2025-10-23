/**
 * BaseNode - Isomorphic Node Base Class
 * Works in both browser (UI) and Node.js (server)
 */

export class BaseNode {
  // Class properties (override in subclasses)
  static type = 'BaseNode';
  static category = 'Unknown'; // 'Primitives' or 'Processors'
  static displayName = 'Base Node';
  static description = 'Base node class';
  
  static inputs = [];   // ['input1', 'input2']
  static outputs = [];  // ['output1', 'output2']
  static params = {};   // { paramName: { type: 'number', default: 0, min: 0, max: 1 } }
  
  static cacheable = true; // Can this node's output be cached?
  static cacheKeyParams = []; // Which params affect cache key? (empty = all params)

  constructor(options = {}) {
    this.gpu = options.gpu || null;      // GPU device (WebGPU or @webgpu/node)
    this.isServer = options.isServer || false; // Running on server?
    this.cache = options.cache || null;  // Optional cache instance
  }

  /**
   * Process - Main entry point (handles caching + monitoring)
   * @param {Object} inputs - Map of input name to data (Float32Array)
   * @param {Object} params - Node parameters
   * @returns {Object} - Map of output name to data
   */
  async process(inputs, params) {
    const nodeId = params._nodeId || this.constructor.type; // Allow custom node IDs
    
    // Generate cache key
    const cacheKey = this.getCacheKey(inputs, params);

    // Check cache
    if (this.constructor.cacheable && this.cache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      
      // Report cache hit to monitor
      this.reportToMonitor({
        nodeType: this.constructor.type,
        nodeId: nodeId,
        cached: true,
        executionTime: 0
      });
      
      if (typeof console !== 'undefined') {
        console.log(`  💾 Cache HIT: ${this.constructor.type} (${nodeId})`);
      }
      return { ...cached, _cached: true };
    }

    // Execute node
    const startTime = Date.now();
    const result = await this.execute(inputs, params);
    const executionTime = Date.now() - startTime;

    // Store in cache
    if (this.constructor.cacheable && this.cache) {
      this.cache.set(cacheKey, result);
    }

    // Report execution to monitor
    this.reportToMonitor({
      nodeType: this.constructor.type,
      nodeId: nodeId,
      cached: false,
      executionTime: executionTime,
      params: this.getMonitorableParams(params),
      outputSize: this.getOutputSize(result)
    });

    return { ...result, _executionTime: executionTime };
  }

  /**
   * Report metrics to monitor (if available)
   */
  reportToMonitor(metrics) {
    // Server-side: Use global monitor
    if (this.isServer && typeof global !== 'undefined' && global.nodeMonitor) {
      global.nodeMonitor.recordNodeExecution(metrics);
    }
    
    // Client-side: Use window monitor
    if (!this.isServer && typeof window !== 'undefined' && window.nodeMonitor) {
      window.nodeMonitor.recordNodeExecution(metrics);
    }
  }

  /**
   * Get parameters safe for monitoring (exclude large arrays)
   */
  getMonitorableParams(params) {
    const safe = {};
    for (const [key, value] of Object.entries(params)) {
      // Skip large data structures
      if (key.startsWith('_')) continue; // Skip internal params
      if (value instanceof Float32Array || value instanceof Uint32Array) continue;
      if (Array.isArray(value) && value.length > 10) continue;
      
      safe[key] = value;
    }
    return safe;
  }

  /**
   * Get size of output data (for memory tracking)
   */
  getOutputSize(result) {
    let totalBytes = 0;
    for (const value of Object.values(result)) {
      if (value instanceof Float32Array || value instanceof Uint32Array) {
        totalBytes += value.byteLength;
      }
    }
    return totalBytes;
  }

  /**
   * Execute - Actual node logic (override in subclasses)
   * @param {Object} inputs - Map of input name to data
   * @param {Object} params - Node parameters
   * @returns {Object} - Map of output name to data
   */
  async execute(inputs, params) {
    throw new Error(`execute() must be implemented by ${this.constructor.type}`);
  }

  /**
   * Generate cache key
   */
  getCacheKey(inputs, params) {
    const keyParams = this.constructor.cacheKeyParams.length > 0
      ? this.constructor.cacheKeyParams
      : Object.keys(params);
    
    const paramStr = keyParams
      .map(k => `${k}:${params[k]}`)
      .join('|');
    
    const inputHash = this.hashInputs(inputs);
    
    return `${this.constructor.type}:${paramStr}:${inputHash}`;
  }

  /**
   * Simple hash of input data
   */
  hashInputs(inputs) {
    let hash = 0;
    
    for (const key in inputs) {
      const data = inputs[key];
      
      if (data instanceof Float32Array || data instanceof Uint32Array) {
        // Sample-based hash (first, middle, last)
        hash ^= data[0] || 0;
        hash ^= data[Math.floor(data.length / 2)] || 0;
        hash ^= data[data.length - 1] || 0;
      } else if (typeof data === 'number') {
        hash ^= data;
      }
    }
    
    return hash.toString(36);
  }

  /**
   * Validate inputs
   */
  validateInputs(inputs) {
    const requiredInputs = this.constructor.inputs;
    
    for (const inputName of requiredInputs) {
      if (!(inputName in inputs)) {
        throw new Error(`${this.constructor.type}: Missing required input '${inputName}'`);
      }
    }
  }

  /**
   * Get default parameters
   */
  static getDefaultParams() {
    const defaults = {};
    
    for (const [name, config] of Object.entries(this.params)) {
      defaults[name] = config.default;
    }
    
    return defaults;
  }

  /**
   * Serialize node state (for saving)
   */
  serialize() {
    return {
      type: this.constructor.type,
      // Add any instance-specific state if needed
    };
  }

  /**
   * Deserialize node state (for loading)
   */
  static deserialize(data, options) {
    return new this(options);
  }
}
