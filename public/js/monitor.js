// Monitor Dashboard JavaScript

let requestChart = null;
let timingChart = null;
let updateInterval = null;

// Chart.js default config
Chart.defaults.color = '#a0a0a0';
Chart.defaults.borderColor = '#3a3a3a';
Chart.defaults.font.family = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
Chart.defaults.font.size = 11;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  startUpdating();
});

function initCharts() {
  // Request Rate Chart
  const requestCtx = document.getElementById('requestChart').getContext('2d');
  requestChart = new Chart(requestCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Cached (Region + Chunk)',
          data: [],
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Full Generation',
          data: [],
          borderColor: '#4a9eff',
          backgroundColor: 'rgba(74, 158, 255, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          backgroundColor: 'rgba(36, 36, 36, 0.95)',
          titleColor: '#e0e0e0',
          bodyColor: '#e0e0e0',
          borderColor: '#3a3a3a',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          stacked: true, // Stack the areas
          title: {
            display: true,
            text: 'Requests per 10s'
          },
          grid: {
            color: 'rgba(58, 58, 58, 0.5)'
          }
        },
        x: {
          stacked: true, // Stack the areas
          display: false
        }
      }
    }
  });

  // Timing Distribution Chart (dynamic node-based)
  const timingCtx = document.getElementById('timingChart').getContext('2d');
  timingChart = new Chart(timingCtx, {
    type: 'bar',
    data: {
      labels: [], // Will be populated dynamically from node stats
      datasets: [{
        label: 'Avg Time (ms)',
        data: [],
        backgroundColor: [],
        borderColor: [],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(36, 36, 36, 0.95)',
          titleColor: '#e0e0e0',
          bodyColor: '#e0e0e0',
          borderColor: '#3a3a3a',
          borderWidth: 1,
          callbacks: {
            label: (context) => `${context.parsed.y.toFixed(2)}ms`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Time (ms)'
          },
          grid: {
            color: 'rgba(58, 58, 58, 0.5)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function startUpdating() {
  updateDashboard(); // Initial update
  updateInterval = setInterval(updateDashboard, 1000); // Update every second
}

async function updateDashboard() {
  try {
    // Fetch legacy stats (for overview cards)
    const statsResponse = await fetch('/monitor/api/stats');
    const stats = await statsResponse.json();

    // Fetch NEW node stats (unified node system)
    const nodeStatsResponse = await fetch('/monitor/api/nodes/stats');
    const nodeStats = await nodeStatsResponse.json();

    // Fetch time series
    const timeSeriesResponse = await fetch('/monitor/api/timeseries?minutes=5');
    const timeSeries = await timeSeriesResponse.json();

    // Update status indicator
    document.getElementById('status-dot').classList.add('active');
    document.getElementById('status-text').textContent = 'Live';

    // Update overview stats (pass nodeStats for cache metrics)
    updateOverviewStats(stats, nodeStats);

    // Update charts
    updateCharts(stats, timeSeries, nodeStats);

    // Update NODE-BASED pipeline breakdown (NEW!)
    updateNodeBreakdown(nodeStats);

    // Update recent requests table
    updateRecentRequests(stats.recentRequests);

    // Update comparison (if baseline is set)
    await updateComparison();

  } catch (error) {
    console.error('Failed to update dashboard:', error);
    document.getElementById('status-dot').classList.remove('active');
    document.getElementById('status-text').textContent = 'Error';
  }
}

function updateOverviewStats(stats, nodeStats) {
  // Uptime
  document.getElementById('uptime').textContent = stats.uptime.formatted;

  // Total chunks
  document.getElementById('total-chunks').textContent = stats.chunks.total.toLocaleString();
  document.getElementById('request-rate').textContent = `${stats.chunks.requestRate} req/s`;

  // Cache stats - use node-based if available
  let cacheRate;
  if (nodeStats && nodeStats.totals) {
    cacheRate = nodeStats.totals.cacheHitRate.toFixed(1);
    // Update sub-stats with node execution counts
    document.getElementById('cached-chunks').textContent = nodeStats.totals.totalCacheHits.toLocaleString();
    document.getElementById('region-cached-chunks').textContent = '0'; // N/A for node-based
    document.getElementById('generated-chunks').textContent = nodeStats.totals.totalCacheMisses.toLocaleString();
  } else {
    // Fallback to legacy chunk-based stats
    cacheRate = stats.chunks.total > 0 
      ? (((stats.chunks.cached + stats.chunks.regionCached) / stats.chunks.total) * 100).toFixed(1)
      : '0.0';
    document.getElementById('cached-chunks').textContent = stats.chunks.cached.toLocaleString();
    document.getElementById('region-cached-chunks').textContent = stats.chunks.regionCached.toLocaleString();
    document.getElementById('generated-chunks').textContent = stats.chunks.fullGeneration.toLocaleString();
  }
  
  document.getElementById('cache-hit-rate').textContent = `${cacheRate}%`;

  // Response time
  if (stats.timings.total) {
    document.getElementById('avg-response').textContent = `${stats.timings.total.avg.toFixed(1)}ms`;
    document.getElementById('recent-response').textContent = `${stats.timings.total.recent.toFixed(1)}ms`;
  }

  // Active regions
  document.getElementById('active-regions').textContent = stats.regions.total;
  
  // Bottleneck Analysis
  if (stats.bottlenecks) {
    // Network
    const avgSize = stats.bottlenecks.network.avgChunkSize;
    if (avgSize > 0) {
      const sizeKB = (avgSize / 1024).toFixed(1);
      document.getElementById('network-size').textContent = `${sizeKB} KB`;
      
      const bandwidth = stats.bottlenecks.network.avgBandwidth;
      const bandwidthMB = (bandwidth / 1024 / 1024).toFixed(2);
      document.getElementById('network-bandwidth').textContent = `${bandwidthMB} MB/s`;
      document.getElementById('network-total').textContent = `${stats.bottlenecks.network.totalMB} MB`;
    }
    
    // Memory
    if (stats.bottlenecks.memory.current) {
      const heapMB = (stats.bottlenecks.memory.current.heapUsed / 1024 / 1024).toFixed(1);
      const rssMB = (stats.bottlenecks.memory.current.rss / 1024 / 1024).toFixed(1);
      document.getElementById('memory-heap').textContent = `${heapMB} MB`;
      document.getElementById('memory-rss').textContent = `RSS: ${rssMB} MB`;
    }
    
    // Response Time (primary metric)
    if (stats.timings.total) {
      document.getElementById('bottleneck-response').textContent = `${stats.timings.total.recent.toFixed(1)}ms`;
    }
    
    // Throughput
    document.getElementById('throughput').textContent = stats.chunks.requestRate;
  }
}

function updateCharts(stats, timeSeries, nodeStats) {
  // Update request rate chart
  if (timeSeries.length > 0) {
    const labels = timeSeries.map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleTimeString();
    });
    // Combine cached + regionCached as "cache hits" (fast)
    const cached = timeSeries.map(d => (d.cached || 0) + (d.regionCached || 0));
    const fullGen = timeSeries.map(d => d.fullGen || 0);

    requestChart.data.labels = labels;
    requestChart.data.datasets[0].data = cached;
    requestChart.data.datasets[1].data = fullGen;
    requestChart.update('none'); // Skip animation for performance
  }

  // Update timing chart with NODE data
  if (nodeStats && nodeStats.nodeStats && nodeStats.nodeStats.length > 0) {
    // Use actual node types from unified system
    const labels = nodeStats.nodeStats.map(n => n.type);
    const avgTimes = nodeStats.nodeStats.map(n => n.avgTime || 0);
    
    // Color code: processors = orange, primitives = blue
    const colors = nodeStats.nodeStats.map(n => {
      if (n.type.includes('Erosion') || n.type.includes('Classifier') || n.type.includes('Generator')) {
        return 'rgba(251, 191, 36, 0.8)'; // Orange for processors
      }
      return 'rgba(74, 158, 255, 0.8)'; // Blue for primitives
    });
    
    const borderColors = nodeStats.nodeStats.map(n => {
      if (n.type.includes('Erosion') || n.type.includes('Classifier') || n.type.includes('Generator')) {
        return '#fbbf24';
      }
      return '#4a9eff';
    });

    timingChart.data.labels = labels;
    timingChart.data.datasets[0].data = avgTimes;
    timingChart.data.datasets[0].backgroundColor = colors;
    timingChart.data.datasets[0].borderColor = borderColors;
    timingChart.update('none');
  } else if (stats.timings) {
    // Fallback to legacy stats if no node stats available
    const timingData = [
      stats.timings.baseElevation?.recent || 0,
      stats.timings.preErosionMoisture?.recent || 0,
      stats.timings.erosion?.recent || 0,
      stats.timings.postErosionMoisture?.recent || 0,
      stats.timings.upscale?.recent || 0,
      stats.timings.chunkGen?.recent || 0,
      stats.timings.svdagBuild?.recent || 0
    ];

    timingChart.data.datasets[0].data = timingData;
    timingChart.update('none');
  }
}

// NEW: Update node-based breakdown (processor + primitive nodes)
function updateNodeBreakdown(nodeStats) {
  if (!nodeStats || !nodeStats.nodeStats) {
    return;
  }

  // Separate processors from primitives
  const processors = nodeStats.nodeStats.filter(n => 
    n.type.includes('Erosion') || 
    n.type.includes('Classifier') || 
    n.type.includes('Generator') ||
    n.type.includes('Upscale')
  );
  
  const primitives = nodeStats.nodeStats.filter(n => 
    n.type.includes('Noise') || 
    n.type.includes('Blend') || 
    n.type.includes('Remap') ||
    n.type.includes('Normalize')
  );

  // Update PROCESSOR nodes (main pipeline stages)
  updateProcessorNodes(processors);
  
  // Update PRIMITIVE nodes (building blocks - hidden by default)
  updatePrimitiveNodes(primitives);
}

function updateProcessorNodes(processors) {
  const container = document.getElementById('processor-nodes-grid');
  
  if (!processors || processors.length === 0) {
    container.innerHTML = `
      <div class="pipeline-stage">
        <div class="stage-name">No processors yet</div>
        <div class="stage-time">Add processor nodes to your pipeline (e.g., HydraulicErosion, BiomeClassifier)</div>
      </div>
    `;
    return;
  }

  // Find max time for bar scaling
  const maxTime = Math.max(...processors.map(p => p.avgTime || 0));

  container.innerHTML = processors.map(node => {
    const cacheRate = node.executions > 0 
      ? ((node.cacheHits / node.executions) * 100).toFixed(1)
      : '0.0';
    
    const avgTime = node.avgTime || 0;
    const barWidth = maxTime > 0 ? (avgTime / maxTime) * 100 : 0;
    
    return `
      <div class="pipeline-stage">
        <div class="stage-name">${node.type}</div>
        <div class="stage-time">
          <strong>${avgTime.toFixed(2)}ms</strong> avg
          <span style="color: #888; font-size: 0.85rem; margin-left: 8px;">
            ${node.executions} exec | ${cacheRate}% cached
          </span>
        </div>
        <div class="stage-bar">
          <div class="stage-bar-fill" style="width: ${barWidth}%; background: #fbbf24;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function updatePrimitiveNodes(primitives) {
  const container = document.getElementById('primitive-nodes-grid');
  
  if (!primitives || primitives.length === 0) {
    container.innerHTML = `
      <div class="pipeline-stage">
        <div class="stage-name">No primitives yet</div>
        <div class="stage-time">Primitives feed data to processors</div>
      </div>
    `;
    return;
  }

  // Find max time for bar scaling
  const maxTime = Math.max(...primitives.map(p => p.avgTime || 0));

  container.innerHTML = primitives.map(node => {
    const cacheRate = node.executions > 0 
      ? ((node.cacheHits / node.executions) * 100).toFixed(1)
      : '0.0';
    
    const avgTime = node.avgTime || 0;
    const barWidth = maxTime > 0 ? (avgTime / maxTime) * 100 : 0;
    
    // Show last params if available
    const paramsStr = node.lastParams 
      ? Object.entries(node.lastParams)
          .slice(0, 3) // First 3 params only
          .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
          .join(', ')
      : '';
    
    return `
      <div class="pipeline-stage">
        <div class="stage-name">${node.type}</div>
        <div class="stage-time">
          <strong>${avgTime.toFixed(2)}ms</strong> avg
          <span style="color: #888; font-size: 0.85rem; margin-left: 8px;">
            ${node.executions} exec | ${cacheRate}% cached
          </span>
          ${paramsStr ? `<div style="color: #666; font-size: 0.75rem; margin-top: 2px;">${paramsStr}</div>` : ''}
        </div>
        <div class="stage-bar">
          <div class="stage-bar-fill" style="width: ${barWidth}%; background: #4a9eff;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Toggle primitive nodes visibility
function togglePrimitives() {
  const grid = document.getElementById('primitive-nodes-grid');
  const toggle = document.getElementById('primitives-toggle');
  
  if (grid.style.display === 'none') {
    grid.style.display = 'grid';
    toggle.textContent = '▼';
  } else {
    grid.style.display = 'none';
    toggle.textContent = '▶';
  }
}

function updateRecentRequests(requests) {
  const tbody = document.getElementById('recent-requests');

  if (!requests || requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">No requests yet...</td></tr>';
    return;
  }

  tbody.innerHTML = requests.map(req => {
    const time = new Date(req.timestamp).toLocaleTimeString();
    
    // Show region cache status
    let badge;
    if (req.cached) {
      badge = '<span class="badge badge-cached">Cached</span>';
    } else if (req.regionCached) {
      badge = '<span class="badge badge-region">Region Cached</span>';
    } else {
      badge = '<span class="badge badge-generated">Full Gen</span>';
    }

    // Show node breakdown if available (future feature)
    const stages = req.stages || {};
    const nodeList = Object.keys(stages).length > 0
      ? Object.entries(stages).map(([name, time]) => `${name}: ${time.toFixed(1)}ms`).join(', ')
      : 'Legacy pipeline';

    return `
      <tr>
        <td>${time}</td>
        <td><code>${req.chunkCoords}</code></td>
        <td>${badge}</td>
        <td><strong>${req.totalTime.toFixed(1)}ms</strong></td>
        <td style="font-size: 0.85rem;">${nodeList}</td>
      </tr>
    `;
  }).join('');
}

async function resetMetrics() {
  if (!confirm('Reset all metrics? This will clear all statistics.')) {
    return;
  }

  try {
    await fetch('/monitor/api/reset', { method: 'POST' });
    location.reload();
  } catch (error) {
    console.error('Failed to reset metrics:', error);
    alert('Failed to reset metrics');
  }
}

// ===== PROFILE MANAGEMENT =====

function showProfileModal() {
  const modal = document.getElementById('save-profile-modal');
  modal.classList.add('active');
  
  // Update preview with current stats
  updateProfilePreview();
}

function showBaselineModal() {
  const modal = document.getElementById('baseline-modal');
  modal.classList.add('active');
  
  // Load profiles list
  loadProfiles();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('active');
}

async function updateProfilePreview() {
  try {
    const response = await fetch('/monitor/api/stats');
    const stats = await response.json();
    
    const preview = document.getElementById('profile-stats-preview');
    preview.innerHTML = `
      <div>Total chunks: <strong>${stats.chunks.total}</strong></div>
      <div>Avg response: <strong>${stats.timings.total?.avg.toFixed(1) || '--'}ms</strong></div>
      <div>Cache rate: <strong>${stats.chunks.cacheHitRate}%</strong></div>
    `;
  } catch (error) {
    console.error('Failed to update preview:', error);
  }
}

async function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const description = document.getElementById('profile-description').value.trim();
  
  if (!name) {
    alert('Please enter a profile name');
    return;
  }

  try {
    const response = await fetch('/monitor/api/profiles/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });

    const result = await response.json();

    if (result.success) {
      alert(`✅ Profile "${name}" saved!`);
      closeModal('save-profile-modal');
      
      // Clear form
      document.getElementById('profile-name').value = '';
      document.getElementById('profile-description').value = '';
    } else {
      alert('Failed to save profile');
    }
  } catch (error) {
    console.error('Failed to save profile:', error);
    alert('Failed to save profile');
  }
}

async function loadProfiles() {
  const container = document.getElementById('profiles-list');
  container.innerHTML = '<div class="loading">Loading profiles...</div>';

  try {
    const response = await fetch('/monitor/api/profiles');
    const profiles = await response.json();

    if (profiles.length === 0) {
      container.innerHTML = '<div class="no-data">No saved profiles yet. Generate some chunks and save a profile!</div>';
      return;
    }

    container.innerHTML = profiles.map(profile => `
      <div class="profile-item">
        <div class="profile-header">
          <span class="profile-name">${profile.name}</span>
          <span class="profile-date">${new Date(profile.timestamp).toLocaleDateString()}</span>
        </div>
        <div class="profile-stats">
          ${profile.samples} samples | 
          ${profile.timings.total ? `${profile.timings.total.avg.toFixed(1)}ms avg` : 'No timing data'}
        </div>
        ${profile.description ? `<div class="profile-description">"${profile.description}"</div>` : ''}
        <div class="profile-actions">
          <button class="btn btn-small btn-primary" onclick="loadBaseline('${profile.filename}')">📊 Use as Baseline</button>
          <button class="btn btn-small btn-secondary" onclick="deleteProfile('${profile.filename}')">🗑️ Delete</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load profiles:', error);
    container.innerHTML = '<div class="no-data">Failed to load profiles</div>';
  }
}

async function loadBaseline(filename) {
  try {
    const response = await fetch('/monitor/api/profiles/baseline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });

    const result = await response.json();

    if (result.success) {
      alert(`✅ Baseline set to "${result.baseline}"`);
      closeModal('baseline-modal');
      
      // Force update to show comparison
      await updateDashboard();
    } else {
      alert('Failed to load baseline');
    }
  } catch (error) {
    console.error('Failed to load baseline:', error);
    alert('Failed to load baseline');
  }
}

async function clearBaseline() {
  if (!confirm('Clear the current baseline?')) {
    return;
  }

  try {
    await fetch('/monitor/api/profiles/baseline/clear', { method: 'POST' });
    
    // Hide comparison section
    document.getElementById('comparison-section').style.display = 'none';
    
  } catch (error) {
    console.error('Failed to clear baseline:', error);
    alert('Failed to clear baseline');
  }
}

async function deleteProfile(filename) {
  if (!confirm('Delete this profile?')) {
    return;
  }

  try {
    await fetch(`/monitor/api/profiles/${filename}`, { method: 'DELETE' });
    
    // Reload profiles list
    loadProfiles();
  } catch (error) {
    console.error('Failed to delete profile:', error);
    alert('Failed to delete profile');
  }
}

async function updateComparison() {
  try {
    const response = await fetch('/monitor/api/comparison');
    const data = await response.json();

    const section = document.getElementById('comparison-section');
    
    if (!data.hasBaseline) {
      section.style.display = 'none';
      return;
    }

    // Show comparison section
    section.style.display = 'block';
    
    const comparison = data.comparison;
    document.getElementById('baseline-name').textContent = comparison.baseline;

    // Build comparison grid
    const grid = document.getElementById('comparison-grid');
    const stages = ['total', 'chunkGen', 'svdagBuild', 'erosion', 'upscale'];
    
    grid.innerHTML = stages
      .filter(stage => comparison[stage])
      .map(stage => {
        const data = comparison[stage];
        const className = data.improved ? 'improved' : (data.percentChange > 0 ? 'regressed' : '');
        const sign = data.diff >= 0 ? '+' : '';
        
        return `
          <div class="comparison-item ${className}">
            <div class="comparison-stage-name">${stage}</div>
            <div class="comparison-values">
              <div class="comparison-current">${data.current.toFixed(1)}ms</div>
              <div class="comparison-baseline">was ${data.baseline.toFixed(1)}ms</div>
            </div>
            <div class="comparison-diff ${data.improved ? 'improved' : 'regressed'}">
              ${sign}${data.diff.toFixed(1)}ms (${sign}${data.percentChange}%)
            </div>
          </div>
        `;
      }).join('');

  } catch (error) {
    console.error('Failed to update comparison:', error);
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
