/**
 * Visualizer - Preview canvas for node outputs
 */
export class Visualizer {
  constructor(previewCanvas, outputCanvas) {
    this.previewCanvas = previewCanvas;
    this.outputCanvas = outputCanvas;
    this.previewCtx = previewCanvas.getContext('2d');
    this.outputCtx = outputCanvas.getContext('2d');
    this.colormap = 'grayscale';
    
    this.setupCanvases();
  }

  setupCanvases() {
    // Set canvas sizes
    this.previewCanvas.width = 512;
    this.previewCanvas.height = 512;
    this.outputCanvas.width = 512;
    this.outputCanvas.height = 512;
  }

  setColormap(colormap) {
    this.colormap = colormap;
  }

  /**
   * Render heightmap data to canvas
   */
  renderHeightmap(data, width, height, canvas) {
    const ctx = canvas === this.previewCanvas ? this.previewCtx : this.outputCtx;
    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const idx = i * 4;

      if (this.colormap === 'grayscale') {
        const gray = Math.floor(value * 255);
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
      } else if (this.colormap === 'terrain') {
        // Terrain colors
        const color = this.getTerrainColor(value);
        imageData.data[idx] = color[0];
        imageData.data[idx + 1] = color[1];
        imageData.data[idx + 2] = color[2];
      }

      imageData.data[idx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  getTerrainColor(height) {
    if (height < 0.2) return [50, 100, 200];    // Water
    if (height < 0.3) return [210, 180, 140];   // Sand
    if (height < 0.6) return [100, 180, 100];   // Grass
    if (height < 0.8) return [139, 137, 137];   // Rock
    return [255, 255, 255];                      // Snow
  }

  renderOutput(mapData, mapType) {
    // Render final output
    this.renderHeightmap(mapData.data, mapData.width, mapData.height, this.outputCanvas);
  }

  clear() {
    this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    this.outputCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
  }
}
