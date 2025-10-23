/**
 * GraphExecutor - Executes node graphs
 * Works on server-side to generate terrain data
 */

export class GraphExecutor {
  constructor(registry, options = {}) {
    this.registry = registry;
    this.gpu = options.gpu || null;
    this.monitor = options.monitor || null; // Optional metrics collector
    this.cache = options.cache || new Map(); // Node result cache
  }

  /**
   * Execute a graph
   * @param {Object} graph - { nodes: [...], connections: [...] }
   * @param {Object} settings - Global settings (seed, resolution, etc.)
   * @returns {Object} - { outputs: {...}, timings: Map, cacheStats: {...} }
   */
  async execute(graph, settings = {}) {
    const startTime = Date.now();
    
    // Topological sort to determine execution order
    const order = this.topologicalSort(graph);
    
    // Storage for node results
    const nodeResults = new Map();
    const timings = new Map();
    const cacheStats = { hits: 0, misses: 0 };

    // Execute nodes in order
    for (const nodeId of order) {
      const nodeData = graph.nodes.find(n => n.id === nodeId);
      
      if (!nodeData) {
        throw new Error(`Node ${nodeId} not found in graph`);
      }

      const NodeClass = this.registry.get(nodeData.type);
      
      // Create node instance
      const node = new NodeClass({
        gpu: this.gpu,
        isServer: true,
        cache: this.cache
      });

      // Gather inputs from connected nodes
      const inputs = this.gatherInputs(nodeId, graph, nodeResults);
      
      // Merge node params with global settings
      const params = { ...settings, ...nodeData.params };
      
      // Execute node
      const nodeStartTime = Date.now();
      const result = await node.process(inputs, params);
      const executionTime = Date.now() - nodeStartTime;
      
      // Track cache stats
      if (result._cached) {
        cacheStats.hits++;
      } else {
        cacheStats.misses++;
      }

      // Store result and timing
      nodeResults.set(nodeId, result);
      timings.set(nodeId, executionTime);

      // Report to monitor if available
      if (this.monitor && typeof this.monitor.recordNodeExecution === 'function') {
        this.monitor.recordNodeExecution({
          nodeId,
          nodeType: nodeData.type,
          category: NodeClass.category,
          executionTime,
          cached: result._cached || false,
          inputSizes: this.getDataSizes(inputs),
          outputSizes: this.getDataSizes(result)
        });
      }

      // Log execution (only for non-cached)
      if (!result._cached) {
        console.log(`  ⚙️  ${nodeData.type} (${nodeId}): ${executionTime}ms`);
      }
    }

    const totalTime = Date.now() - startTime;

    // Extract final outputs (nodes with no outgoing connections)
    const outputs = this.extractOutputs(graph, nodeResults);

    return {
      outputs,
      timings,
      cacheStats,
      totalTime
    };
  }

  /**
   * Topological sort - determine execution order
   */
  topologicalSort(graph) {
    const { nodes, connections } = graph;
    
    // Build adjacency list
    const adj = new Map();
    const inDegree = new Map();
    
    for (const node of nodes) {
      adj.set(node.id, []);
      inDegree.set(node.id, 0);
    }
    
    for (const conn of connections) {
      adj.get(conn.from).push(conn.to);
      inDegree.set(conn.to, inDegree.get(conn.to) + 1);
    }
    
    // Find nodes with no incoming edges
    const queue = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }
    
    // Kahn's algorithm
    const order = [];
    
    while (queue.length > 0) {
      const nodeId = queue.shift();
      order.push(nodeId);
      
      for (const neighborId of adj.get(nodeId)) {
        inDegree.set(neighborId, inDegree.get(neighborId) - 1);
        
        if (inDegree.get(neighborId) === 0) {
          queue.push(neighborId);
        }
      }
    }
    
    // Check for cycles
    if (order.length !== nodes.length) {
      throw new Error('Graph contains cycles - cannot execute');
    }
    
    return order;
  }

  /**
   * Gather inputs for a node from connected nodes
   */
  gatherInputs(nodeId, graph, nodeResults) {
    const inputs = {};
    
    // Find all connections TO this node
    const incomingConnections = graph.connections.filter(c => c.to === nodeId);
    
    for (const conn of incomingConnections) {
      const sourceResult = nodeResults.get(conn.from);
      
      if (!sourceResult) {
        throw new Error(`Source node ${conn.from} has no result`);
      }
      
      // Get output from source node
      const sourceOutput = sourceResult[conn.fromOutput];
      
      if (!sourceOutput) {
        throw new Error(`Source node ${conn.from} has no output '${conn.fromOutput}'`);
      }
      
      // Set as input to this node
      inputs[conn.toInput] = sourceOutput;
    }
    
    return inputs;
  }

  /**
   * Extract final outputs from graph
   * Outputs are nodes marked as outputs or nodes with no outgoing connections
   */
  extractOutputs(graph, nodeResults) {
    const outputs = {};
    
    // Find output nodes (no outgoing connections)
    const outputNodeIds = graph.nodes
      .filter(node => {
        const hasOutgoing = graph.connections.some(c => c.from === node.id);
        return !hasOutgoing || node.isOutput;
      })
      .map(node => node.id);
    
    // Collect their outputs
    for (const nodeId of outputNodeIds) {
      const result = nodeResults.get(nodeId);
      const node = graph.nodes.find(n => n.id === nodeId);
      
      if (result) {
        // Use node label as key, or node ID if no label
        const key = node.label || node.type || nodeId;
        Object.assign(outputs, result);
      }
    }
    
    return outputs;
  }

  /**
   * Get data sizes (for monitoring)
   */
  getDataSizes(data) {
    const sizes = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Float32Array || value instanceof Uint32Array) {
        sizes[key] = value.length;
      }
    }
    
    return sizes;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️  Cleared node cache');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}
