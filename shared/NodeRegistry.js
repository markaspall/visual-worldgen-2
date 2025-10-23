/**
 * NodeRegistry - Central registry for all node types
 * Manages node registration and instantiation
 */

export class NodeRegistry {
  constructor() {
    this.nodes = new Map(); // type -> NodeClass
    this.categories = new Map(); // category -> [types]
  }

  /**
   * Register a node class
   */
  register(NodeClass) {
    const type = NodeClass.type;
    const category = NodeClass.category;

    if (this.nodes.has(type)) {
      console.warn(`⚠️  Node type '${type}' already registered, overwriting`);
    }

    this.nodes.set(type, NodeClass);

    // Add to category
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category).push(type);

    console.log(`✅ Registered node: ${type} (${category})`);
  }

  /**
   * Register multiple nodes
   */
  registerAll(NodeClasses) {
    for (const NodeClass of NodeClasses) {
      this.register(NodeClass);
    }
  }

  /**
   * Get node class by type
   */
  get(type) {
    const NodeClass = this.nodes.get(type);
    
    if (!NodeClass) {
      throw new Error(`Node type '${type}' not found in registry`);
    }
    
    return NodeClass;
  }

  /**
   * Check if node type exists
   */
  has(type) {
    return this.nodes.has(type);
  }

  /**
   * Create node instance
   */
  create(type, options = {}) {
    const NodeClass = this.get(type);
    return new NodeClass(options);
  }

  /**
   * Get all node types
   */
  getTypes() {
    return Array.from(this.nodes.keys());
  }

  /**
   * Get nodes by category
   */
  getByCategory(category) {
    return this.categories.get(category) || [];
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.categories.keys());
  }

  /**
   * Get node metadata (for UI)
   */
  getMetadata(type) {
    const NodeClass = this.get(type);
    
    return {
      type: NodeClass.type,
      category: NodeClass.category,
      displayName: NodeClass.displayName,
      description: NodeClass.description,
      inputs: NodeClass.inputs,
      outputs: NodeClass.outputs,
      params: NodeClass.params,
      cacheable: NodeClass.cacheable
    };
  }

  /**
   * Get all node metadata (for UI palette)
   */
  getAllMetadata() {
    const metadata = {};
    
    for (const type of this.nodes.keys()) {
      metadata[type] = this.getMetadata(type);
    }
    
    return metadata;
  }

  /**
   * Export registry state (for debugging)
   */
  export() {
    return {
      nodeCount: this.nodes.size,
      types: this.getTypes(),
      categories: Object.fromEntries(this.categories)
    };
  }
}

// Create global registry instance
export const registry = new NodeRegistry();
