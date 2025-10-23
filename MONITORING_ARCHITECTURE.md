# 🔍 Monitoring Architecture

## Overview

Every node in the unified system **automatically reports** its execution metrics to the monitor. No manual integration needed!

---

## How It Works

### **1. BaseNode Has Built-In Monitoring**

```javascript
// shared/nodes/BaseNode.js
async process(inputs, params) {
  // Execute node
  const result = await this.execute(inputs, params);
  
  // ✅ Automatically report to monitor
  this.reportToMonitor({
    nodeType: 'PerlinNoise',
    nodeId: 'base_terrain',  // Optional custom ID
    cached: false,
    executionTime: 12,       // milliseconds
    params: { frequency: 0.001, octaves: 4 },
    outputSize: 262144       // bytes
  });
  
  return result;
}
```

**Every node execution is tracked!**

### **2. NodeMonitor Collects Metrics**

```javascript
// server/lib/NodeMonitor.js
class NodeMonitor {
  recordNodeExecution(data) {
    // Track per node TYPE
    // - PerlinNoise: 45 executions, 15 cache hits, avg 12ms
    // - HydraulicErosion: 12 executions, 8 cache hits, avg 45ms
    
    // Track per node INSTANCE (if using custom nodeId)
    // - base_terrain: 23 executions, avg 11ms
    // - detail_noise: 23 executions, avg 3ms
  }
}
```

**Automatically aggregates:**
- Total executions
- Cache hits/misses
- Min/max/avg execution time
- Memory usage
- Recent execution history

---

## What You See in the Monitor

### **Node Performance Table**

```
┌───────────────────┬────────────┬───────────┬────────────┬─────────┐
│ Node Type         │ Executions │ Cache Hit │ Avg Time   │ Total   │
├───────────────────┼────────────┼───────────┼────────────┼─────────┤
│ PerlinNoise       │ 156        │ 89.7%     │ 12.3ms     │ 1.9s    │
│ HydraulicErosion  │ 12         │ 66.7%     │ 45.2ms     │ 542ms   │
│ BiomeClassifier   │ 12         │ 100%      │ 0ms        │ 0ms     │
│ Upscale           │ 24         │ 50.0%     │ 8.1ms      │ 194ms   │
└───────────────────┴────────────┴───────────┴────────────┴─────────┘
```

### **Per-Instance Breakdown** (if using nodeId)

```
PerlinNoise Instances:
  - continental_base: 23 exec, avg 15ms (freq: 0.0005)
  - regional_detail: 23 exec, avg 8ms  (freq: 0.002)
  - local_noise:     23 exec, avg 3ms  (freq: 0.01)
```

### **Time-Series Chart**

```
Execution Time (last 5 minutes)
60ms ┤           
50ms ┤        ╭╮  
40ms ┤     ╭──╯╰─╮     ╭ HydraulicErosion (when cache misses)
30ms ┤  ╭──╯     ╰──╮  │
20ms ┼──╯           ╰─╯
10ms ┼─────────────────  ← PerlinNoise (consistent)
 0ms └─────────────────
```

---

## API Endpoints

### **Get All Node Stats**
```bash
GET /monitor/api/nodes/stats
```

**Response:**
```json
{
  "totals": {
    "totalExecutions": 204,
    "totalCacheHits": 156,
    "totalCacheMisses": 48,
    "totalTime": 2736,
    "cacheHitRate": 76.5
  },
  "nodeStats": [
    {
      "type": "PerlinNoise",
      "executions": 156,
      "cacheHits": 140,
      "cacheMisses": 16,
      "totalTime": 1920,
      "minTime": 8,
      "maxTime": 18,
      "avgTime": 12.3,
      "totalOutputSize": 4194304,
      "lastParams": {
        "frequency": 0.001,
        "octaves": 4,
        "persistence": 0.5
      },
      "timings": [12, 13, 11, 12, ...] // Last 100
    }
  ],
  "instanceStats": [...],
  "recentExecutions": [...]
}
```

### **Get Specific Node Stats**
```bash
GET /monitor/api/nodes/PerlinNoise/stats
```

**Response:**
```json
{
  "type": "PerlinNoise",
  "executions": 156,
  "cacheHits": 140,
  "cacheMisses": 16,
  "avgTime": 12.3,
  ...
}
```

---

## How to Use Custom Node IDs

### **In Pipeline JSON:**

```json
{
  "nodes": [
    {
      "id": "continental_base",  // ← This becomes nodeId
      "type": "PerlinNoise",
      "params": {
        "frequency": 0.0005,
        "octaves": 1
      }
    },
    {
      "id": "regional_detail",   // ← Another nodeId
      "type": "PerlinNoise",
      "params": {
        "frequency": 0.002,
        "octaves": 2
      }
    }
  ]
}
```

### **In GraphExecutor:**

```javascript
// GraphExecutor passes nodeId to BaseNode
const result = await node.process(inputs, {
  ...nodeData.params,
  _nodeId: nodeData.id  // ← Custom ID for monitoring
});
```

### **What You See:**

**Monitor shows:**
```
PerlinNoise - 3 instances:
  ├─ continental_base: avg 15ms (freq: 0.0005)
  ├─ regional_detail:  avg 8ms  (freq: 0.002)
  └─ local_noise:      avg 3ms  (freq: 0.01)
```

---

## Benefits

### ✅ **Zero Configuration**
- Every node automatically reports
- No manual instrumentation needed
- Works for ALL nodes (primitives + processors)

### ✅ **Granular Insights**
- See which nodes are slow
- Track cache effectiveness per node
- Identify bottlenecks in pipeline

### ✅ **Per-Instance Tracking**
- Multiple PerlinNoise nodes? See each one separately!
- Compare "continental" vs "detail" noise performance

### ✅ **Memory Tracking**
- See output sizes per node
- Identify memory-heavy nodes

### ✅ **Time-Series Data**
- Track performance over time
- Detect regressions
- A/B test parameter changes

---

## Example Monitor Output

**For current test_world pipeline:**

```
🌍 World: test_world
📊 Node Performance (last 5 minutes)

┌─────────────────┬──────┬──────────┬──────────┬─────────┐
│ Node            │ Exec │ Cache    │ Avg Time │ Total   │
├─────────────────┼──────┼──────────┼──────────┼─────────┤
│ PerlinNoise     │ 156  │ 89.7%    │ 12.3ms   │ 1.9s    │
│  └─ perlin1     │ 156  │ 89.7%    │ 12.3ms   │ 1.9s    │
└─────────────────┴──────┴──────────┴──────────┴─────────┘

Overall Cache Hit Rate: 89.7% ✅
Total Pipeline Time: 1.9s
Memory Used: 4.0 MB

Last 10 Executions:
  1. PerlinNoise (perlin1) - 12ms - cached ❌
  2. PerlinNoise (perlin1) - 0ms  - cached ✅
  3. PerlinNoise (perlin1) - 0ms  - cached ✅
  ...
```

---

## Future Enhancements

### **Pipeline Comparison**
```bash
# Compare two pipeline versions
GET /monitor/api/nodes/compare?baseline=v1&current=v2
```

### **Flamegraph**
Show execution stack for complex pipelines:
```
Total: 156ms
├─ PerlinNoise (continental): 45ms
├─ PerlinNoise (regional): 28ms
├─ BlendNode: 2ms
├─ HydraulicErosion: 67ms
└─ BiomeClassifier: 14ms
```

### **Alerts**
```javascript
// Alert if node execution time > threshold
if (avgTime > 50) {
  alert(`⚠️ ${nodeType} is slow: ${avgTime}ms`);
}
```

---

## Summary

**Every node is now a first-class citizen in the monitoring system!**

- ✅ **BaseNode** has built-in hooks
- ✅ **NodeMonitor** tracks everything automatically
- ✅ **Monitor UI** shows per-node metrics
- ✅ **No manual integration** needed

**When you add a new node, it's automatically monitored!** 🎉
