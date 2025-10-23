/**
 * NodeMonitor - Pluggable monitoring for unified node system
 * Automatically tracks execution metrics for ANY node type
 */

export class NodeMonitor {
  constructor() {
    this.reset();
  }

  reset() {
    // Per-node-type metrics
    this.nodeMetrics = new Map(); // nodeType -> { executions, totalTime, cacheHits, cacheMisses, etc. }
    
    // Per-node-instance metrics (if using nodeId)
    this.instanceMetrics = new Map(); // nodeId -> { ... }
    
    // Time-series data (last 1000 executions)
    this.executionHistory = [];
    
    // Current pipeline execution
    this.currentPipeline = null;
  }

  /**
   * Called by BaseNode.reportToMonitor()
   */
  recordNodeExecution(data) {
    const { nodeType, nodeId, cached, executionTime, params, outputSize } = data;
    
    // Update node type metrics
    if (!this.nodeMetrics.has(nodeType)) {
      this.nodeMetrics.set(nodeType, {
        type: nodeType,
        executions: 0,
        cacheHits: 0,
        cacheMisses: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0,
        totalOutputSize: 0,
        lastParams: null,
        timings: [] // Last 100 timings
      });
    }

    const metrics = this.nodeMetrics.get(nodeType);
    
    metrics.executions++;
    
    if (cached) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
      metrics.totalTime += executionTime;
      metrics.minTime = Math.min(metrics.minTime, executionTime);
      metrics.maxTime = Math.max(metrics.maxTime, executionTime);
      metrics.avgTime = metrics.totalTime / metrics.cacheMisses;
      
      metrics.timings.push(executionTime);
      if (metrics.timings.length > 100) {
        metrics.timings = metrics.timings.slice(-100);
      }
    }
    
    if (outputSize) {
      metrics.totalOutputSize += outputSize;
    }
    
    if (params) {
      metrics.lastParams = params;
    }

    // Update instance metrics (if nodeId provided)
    if (nodeId && nodeId !== nodeType) {
      if (!this.instanceMetrics.has(nodeId)) {
        this.instanceMetrics.set(nodeId, {
          id: nodeId,
          type: nodeType,
          executions: 0,
          totalTime: 0,
          avgTime: 0
        });
      }

      const instanceMetrics = this.instanceMetrics.get(nodeId);
      instanceMetrics.executions++;
      if (!cached) {
        instanceMetrics.totalTime += executionTime;
        instanceMetrics.avgTime = instanceMetrics.totalTime / instanceMetrics.executions;
      }
    }

    // Add to execution history
    this.executionHistory.push({
      timestamp: Date.now(),
      nodeType,
      nodeId,
      cached,
      executionTime
    });

    // Keep last 1000
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }
  }

  /**
   * Mark start of pipeline execution
   */
  startPipeline(pipelineId) {
    this.currentPipeline = {
      id: pipelineId,
      startTime: Date.now(),
      nodes: []
    };
  }

  /**
   * Mark end of pipeline execution
   */
  endPipeline() {
    if (this.currentPipeline) {
      this.currentPipeline.endTime = Date.now();
      this.currentPipeline.totalTime = this.currentPipeline.endTime - this.currentPipeline.startTime;
      
      // Archive pipeline execution
      // Could store these for comparison
      
      this.currentPipeline = null;
    }
  }

  /**
   * Get stats for monitor dashboard
   */
  getStats() {
    const nodeStats = Array.from(this.nodeMetrics.values());
    
    // Calculate totals
    const totals = {
      totalExecutions: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      totalTime: 0,
      cacheHitRate: 0
    };

    for (const stats of nodeStats) {
      totals.totalExecutions += stats.executions;
      totals.totalCacheHits += stats.cacheHits;
      totals.totalCacheMisses += stats.cacheMisses;
      totals.totalTime += stats.totalTime;
    }

    if (totals.totalExecutions > 0) {
      totals.cacheHitRate = (totals.totalCacheHits / totals.totalExecutions) * 100;
    }

    return {
      totals,
      nodeStats: nodeStats.sort((a, b) => b.totalTime - a.totalTime), // Sort by total time
      instanceStats: Array.from(this.instanceMetrics.values()),
      recentExecutions: this.executionHistory.slice(-50)
    };
  }

  /**
   * Get time-series data for charts
   */
  getTimeSeriesData(minutes = 5) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recent = this.executionHistory.filter(e => e.timestamp >= cutoff);

    // Group by node type
    const byNodeType = new Map();
    
    for (const execution of recent) {
      if (!byNodeType.has(execution.nodeType)) {
        byNodeType.set(execution.nodeType, []);
      }
      byNodeType.get(execution.nodeType).push(execution);
    }

    return {
      nodeTypes: Array.from(byNodeType.keys()),
      data: Object.fromEntries(byNodeType)
    };
  }

  /**
   * Get detailed stats for a specific node type
   */
  getNodeTypeStats(nodeType) {
    return this.nodeMetrics.get(nodeType) || null;
  }
}

// Create global singleton
export const nodeMonitor = new NodeMonitor();
