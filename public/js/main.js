import { WebGPUContext } from './webgpu.js';
import { NodeEditor } from './nodeEditor.js';
import { Visualizer } from './visualizer.js';
import { PipelineManager } from './pipeline.js';

// Import unified node system (served from /shared route)
import { NodeRegistry } from '/shared/NodeRegistry.js';
import { PerlinNoiseNode } from '/shared/nodes/primitives/PerlinNoiseNode.js';
import { BlendNode } from '/shared/nodes/primitives/BlendNode.js';
import { RemapNode } from '/shared/nodes/primitives/RemapNode.js';
import { NormalizeNode } from '/shared/nodes/primitives/NormalizeNode.js';
import { GradientNode } from '/shared/nodes/primitives/GradientNode.js';
import { ConstantNode } from '/shared/nodes/primitives/ConstantNode.js';
import { BiomeClassifierNode } from '/shared/nodes/processors/BiomeClassifierNode.js';
import { DownsampleNode } from '/shared/nodes/processors/DownsampleNode.js';
import { UpsampleNode } from '/shared/nodes/processors/UpsampleNode.js';
import { HydraulicErosionNode } from '/shared/nodes/processors/HydraulicErosionNode.js';
import { ElevationOutputNode } from '/shared/nodes/outputs/ElevationOutputNode.js';

// Create global registry for browser
window.nodeRegistry = new NodeRegistry();

// Register all primitives
window.nodeRegistry.register(PerlinNoiseNode);
window.nodeRegistry.register(BlendNode);
window.nodeRegistry.register(RemapNode);
window.nodeRegistry.register(NormalizeNode);
window.nodeRegistry.register(GradientNode);
window.nodeRegistry.register(ConstantNode);

// Register processors
window.nodeRegistry.register(BiomeClassifierNode);
window.nodeRegistry.register(DownsampleNode);
window.nodeRegistry.register(UpsampleNode);
window.nodeRegistry.register(HydraulicErosionNode);
// window.nodeRegistry.register(BlockClassifierNode); // Coming next

// Register outputs
window.nodeRegistry.register(ElevationOutputNode);

console.log('📦 Frontend registered nodes:', window.nodeRegistry.getTypes());
console.log('   Primitives:', window.nodeRegistry.getByCategory('Primitives').join(', '));
console.log('   Processors:', window.nodeRegistry.getByCategory('Processors').join(', '));
console.log('   Outputs:', window.nodeRegistry.getByCategory('Outputs').join(', '));

class App {
  constructor() {
    this.gpu = null;
    this.visualizer = null;
    this.pipeline = null;
    
    this.elements = {
      gpuStatus: document.getElementById('gpu-status'),
      generationStatus: document.getElementById('generation-status'),
      btnSave: document.getElementById('btn-save'),
      btnLoad: document.getElementById('btn-load'),
      btnEnterWorld: document.getElementById('btn-enter-world'),
      previewCanvas: document.getElementById('preview-canvas'),
      outputCanvas: document.getElementById('output-canvas'),
      // Modals
      modalLoadWorld: document.getElementById('modal-load-world'),
      modalSaveWorld: document.getElementById('modal-save-world'),
      modalMessage: document.getElementById('modal-message')
    };
  }

  async init() {
    console.log('Initializing Visual World Generator...');
    
    // Initialize WebGPU
    this.updateStatus('Initializing WebGPU...', 'loading');
    try {
      this.gpu = new WebGPUContext();
      await this.gpu.init();
      this.elements.gpuStatus.textContent = '✅ WebGPU Ready';
      console.log('✅ WebGPU initialized');
    } catch (error) {
      this.elements.gpuStatus.textContent = '❌ WebGPU Not Available';
      console.error('WebGPU initialization failed:', error);
      alert('WebGPU is required but not available. Please use a compatible browser (Chrome/Edge 113+).');
      return;
    }

    // Initialize visualizer
    this.visualizer = new Visualizer(
      this.elements.previewCanvas,
      this.elements.outputCanvas
    );
    console.log('✅ Visualizer initialized');

    // Initialize pipeline manager
    this.pipeline = new PipelineManager(this.gpu, this.visualizer);
    console.log('✅ Pipeline manager initialized');

    // Initialize node editor
    this.editor = new NodeEditor(
      document.getElementById('rete'),
      this.pipeline,
      this.visualizer
    );
    await this.editor.init();
    console.log('✅ Node editor initialized');

    // Set up event listeners
    this.setupEventListeners();

    // Create default graph
    await this.createDefaultGraph();

    this.updateStatus('Ready', 'ready');
    console.log('🎉 Application ready!');
  }

  setupEventListeners() {
    // Load button
    this.elements.btnLoad.addEventListener('click', async () => {
      await this.showLoadModal();
    });

    // Save button
    this.elements.btnSave.addEventListener('click', async () => {
      await this.showSaveModal();
    });

    // Enter World button
    this.elements.btnEnterWorld.addEventListener('click', () => {
      // Open the infinite viewer for current world
      window.open('/infinite', '_blank');
      this.updateStatus('Opening 3D viewer...', 'info');
    });

    // Fullsize toggle
    const btnFullsize = document.getElementById('btn-fullsize');
    if (btnFullsize) {
      const mainLayout = document.querySelector('.main-layout');
      let isFullsize = false;
      
      btnFullsize.addEventListener('click', () => {
        isFullsize = !isFullsize;
        if (isFullsize) {
          mainLayout.classList.add('fullsize');
          btnFullsize.textContent = '⛶ Exit Full Size';
        } else {
          mainLayout.classList.remove('fullsize');
          btnFullsize.textContent = '⛶ Full Size';
        }
        
        // Trigger resize event for canvas
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 550);
      });
    }

    // Add Node button
    const btnAddNode = document.getElementById('btn-add-node');
    if (btnAddNode) {
      btnAddNode.addEventListener('click', () => {
        this.showNodePalette();
      });
    }

    // Clear button
    const btnClear = document.getElementById('btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('Clear all nodes and connections?')) {
          this.editor.clear();
        }
      });
    }

    // Auto Layout button
    const btnAutoLayout = document.getElementById('btn-auto-layout');
    if (btnAutoLayout) {
      btnAutoLayout.addEventListener('click', () => {
        this.editor.autoLayout();
      });
    }
  }

  showNodePalette() {
    const palette = document.createElement('div');
    palette.className = 'node-palette-overlay';
    palette.innerHTML = `
      <div class="node-palette">
        <div class="palette-header">
          <h3>Add Node</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="palette-body">
          <div class="palette-category">
            <h4>🧱 Primitives</h4>
            <div class="palette-nodes" id="primitives-list"></div>
          </div>
          <div class="palette-category">
            <h4>⚙️ Processors</h4>
            <div class="palette-nodes" id="processors-list"></div>
          </div>
        </div>
      </div>
    `;

    // Populate node lists from registry
    const primitivesList = palette.querySelector('#primitives-list');
    const processorsList = palette.querySelector('#processors-list');

    window.nodeRegistry.getTypes().forEach(type => {
      const metadata = window.nodeRegistry.getMetadata(type);
      const nodeBtn = document.createElement('button');
      nodeBtn.className = 'palette-node-btn';
      nodeBtn.innerHTML = `
        <div class="node-name">${metadata.displayName}</div>
        <div class="node-desc">${metadata.description}</div>
      `;
      nodeBtn.addEventListener('click', () => {
        this.editor.addNodeFromPalette(type);
        document.body.removeChild(palette);
      });

      if (metadata.category === 'Primitives') {
        primitivesList.appendChild(nodeBtn);
      } else {
        processorsList.appendChild(nodeBtn);
      }
    });

    // Close button
    palette.querySelector('.close-btn').addEventListener('click', () => {
      document.body.removeChild(palette);
    });

    // Click outside to close
    palette.addEventListener('click', (e) => {
      if (e.target === palette) {
        document.body.removeChild(palette);
      }
    });

    document.body.appendChild(palette);
  }

  async createDefaultGraph() {
    // Start with empty canvas
    console.log('Ready - add nodes to begin');
  }

  async showLoadModal() {
    // Load pipeline from current world
    await this.loadPipeline();
  }

  async showSaveModal() {
    // Just save directly - no modal needed
    await this.savePipeline();
  }

  async loadPipeline() {
    try {
      this.updateStatus('Loading pipeline...', 'loading');

      const response = await fetch('/api/v2/pipeline');
      const data = await response.json();

      if (data.success) {
        // Load graph into editor
        this.editor.loadGraph(data.pipeline);
        this.updateStatus(`Loaded pipeline`, 'success');
        this.showMessage('Success', `Loaded pipeline from "${data.worldId}"\n\nNodes: ${data.pipeline.nodes?.length || 0}\nConnections: ${data.pipeline.connections?.length || 0}`, 'success');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Load pipeline error:', error);
      this.updateStatus('Load failed', 'error');
      this.showMessage('Error', `Failed to load pipeline: ${error.message}`, 'error');
    }
  }

  async savePipeline() {
    try {
      const graph = this.editor.getGraph();
      this.updateStatus('Saving pipeline...', 'loading');

      const response = await fetch('/api/v2/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nodes: graph.nodes,
          connections: graph.connections,
          metadata: {
            savedAt: new Date().toISOString(),
            nodeCount: graph.nodes.length,
            connectionCount: graph.connections.length
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        this.updateStatus('Pipeline saved', 'success');
        this.showMessage('Success', `Pipeline saved to world "${result.worldId}"!\n\nNodes: ${graph.nodes.length}\nConnections: ${graph.connections.length}\n\n💡 Click "🎮 Enter World" to view it in 3D!`, 'success');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Save pipeline error:', error);
      this.updateStatus('Save failed', 'error');
      this.showMessage('Error', `Failed to save: ${error.message}`, 'error');
    }
  }

  showMessage(title, text, type = 'info') {
    const modal = this.elements.modalMessage;
    const titleEl = document.getElementById('message-title');
    const textEl = document.getElementById('message-text');

    titleEl.textContent = type === 'success' ? '✅ ' + title : type === 'error' ? '❌ ' + title : title;
    textEl.textContent = text;
    textEl.style.whiteSpace = 'pre-line';

    modal.style.display = 'flex';
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateStatus(message, type = 'info') {
    this.elements.generationStatus.textContent = message;
    this.elements.generationStatus.className = `status-${type}`;
  }
}

// Initialize app when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  const app = new App();
  await app.init();
  
  // Expose for debugging
  window.app = app;
});
