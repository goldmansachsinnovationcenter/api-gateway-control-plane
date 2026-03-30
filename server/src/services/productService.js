import db from '../models/database.js';
import { v4 as uuidv4 } from 'uuid';

export function createProduct(name, description) {
  const id = uuidv4();
  db.prepare('INSERT INTO products (id, name, description) VALUES (?, ?, ?)').run(id, name, description || '');
  return { id, name, description, mcp_enabled: 0, apis: [] };
}

export function listProducts() {
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  return products.map(p => {
    const apis = db.prepare(`
      SELECT apis.* FROM apis 
      JOIN product_apis ON apis.id = product_apis.api_id 
      WHERE product_apis.product_id = ?
    `).all(p.id);
    const mcpServer = db.prepare('SELECT * FROM mcp_servers WHERE product_id = ?').get(p.id);
    return { ...p, apis, mcpServer };
  });
}

export function getProduct(id) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return null;
  const apis = db.prepare(`
    SELECT apis.*, gateways.name as gateway_name, gateways.type as gateway_type 
    FROM apis 
    JOIN product_apis ON apis.id = product_apis.api_id 
    JOIN gateways ON apis.gateway_id = gateways.id
    WHERE product_apis.product_id = ?
  `).all(id);
  const mcpServer = db.prepare('SELECT * FROM mcp_servers WHERE product_id = ?').get(id);
  return { ...product, apis, mcpServer };
}

export function deleteProduct(id) {
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
}

export function assignApiToProduct(productId, apiId) {
  try {
    db.prepare('INSERT INTO product_apis (product_id, api_id) VALUES (?, ?)').run(productId, apiId);
    return true;
  } catch (err) {
    if (err.message.includes('UNIQUE')) return false; // already assigned
    throw err;
  }
}

export function unassignApiFromProduct(productId, apiId) {
  db.prepare('DELETE FROM product_apis WHERE product_id = ? AND api_id = ?').run(productId, apiId);
}

export function getAvailableApis(productId) {
  return db.prepare(`
    SELECT apis.*, gateways.name as gateway_name, gateways.type as gateway_type 
    FROM apis 
    JOIN gateways ON apis.gateway_id = gateways.id
    WHERE apis.id NOT IN (
      SELECT api_id FROM product_apis WHERE product_id = ?
    )
    ORDER BY apis.name
  `).all(productId);
}

export function toggleMcp(productId, enabled) {
  db.prepare('UPDATE products SET mcp_enabled = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(enabled ? 1 : 0, productId);

  if (enabled) {
    const apiKey = uuidv4();
    const existing = db.prepare('SELECT * FROM mcp_servers WHERE product_id = ?').get(productId);
    if (!existing) {
      const serverId = uuidv4();
      const endpoint = `/mcp/${productId}`;
      db.prepare('INSERT INTO mcp_servers (id, product_id, endpoint, api_key, status) VALUES (?, ?, ?, ?, ?)')
        .run(serverId, productId, endpoint, apiKey, 'running');
      return { serverId, endpoint, apiKey, status: 'running' };
    } else {
      return { serverId: existing.id, endpoint: existing.endpoint, apiKey: existing.api_key, status: existing.status };
    }
  } else {
    db.prepare('DELETE FROM mcp_servers WHERE product_id = ?').run(productId);
    return null;
  }
}
