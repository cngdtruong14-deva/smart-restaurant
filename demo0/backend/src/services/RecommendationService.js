const { pool } = require('../config/database');
const { redisClient } = require('../config/database');

class RecommendationService {
  constructor() {
    this.userProductMatrix = new Map();
    this.productProductMatrix = new Map();
  }

  async initialize() {
    await this.buildMatrices();
    // Rebuild matrices every hour
    setInterval(() => this.buildMatrices(), 3600000);
  }

  async buildMatrices() {
    // Build user-product interaction matrix for collaborative filtering
    const [interactions] = await pool.execute(`
      SELECT 
        o.customer_id,
        oi.product_id,
        COUNT(*) as interaction_count,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY o.customer_id, oi.product_id
    `);

    // Reset matrices
    this.userProductMatrix.clear();
    this.productProductMatrix.clear();

    // Build user-product matrix
    interactions.forEach(interaction => {
      if (!this.userProductMatrix.has(interaction.customer_id)) {
        this.userProductMatrix.set(interaction.customer_id, new Map());
      }
      this.userProductMatrix
        .get(interaction.customer_id)
        .set(interaction.product_id, interaction.interaction_count);
    });

    // Build product-product similarity matrix (simplified)
    this.buildProductSimilarityMatrix();
  }

  async getRecommendations(userId, restaurantId, limit = 5) {
    const cacheKey = `recs:${userId}:${restaurantId}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let recommendations = [];

    // Collaborative Filtering
    const cfRecs = await this.getCollaborativeFilteringRecs(userId, restaurantId);
    recommendations.push(...cfRecs);

    // Content-based Filtering
    const cbRecs = await this.getContentBasedRecs(userId, restaurantId);
    recommendations.push(...cbRecs);

    // Popular items fallback
    if (recommendations.length < limit) {
      const popularRecs = await this.getPopularRecs(restaurantId, limit - recommendations.length);
      recommendations.push(...popularRecs);
    }

    // Deduplicate and sort by score
    const uniqueRecs = Array.from(
      new Map(recommendations.map(item => [item.product_id, item])).values()
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    // Cache for 10 minutes
    await redisClient.setEx(cacheKey, 600, JSON.stringify(uniqueRecs));

    return uniqueRecs;
  }

  async getCollaborativeFilteringRecs(userId, restaurantId) {
    const userInteractions = this.userProductMatrix.get(userId) || new Map();
    
    // Find similar users
    const similarUsers = [];
    
    for (const [otherUserId, otherProducts] of this.userProductMatrix.entries()) {
      if (otherUserId === userId) continue;
      
      let similarity = 0;
      for (const [productId, score] of userInteractions.entries()) {
        if (otherProducts.has(productId)) {
          similarity += Math.min(score, otherProducts.get(productId));
        }
      }
      
      if (similarity > 0) {
        similarUsers.push({ userId: otherUserId, similarity });
      }
    }

    // Sort by similarity
    similarUsers.sort((a, b) => b.similarity - a.similarity);

    // Get recommendations from top similar users
    const recommendations = [];
    for (const similarUser of similarUsers.slice(0, 3)) {
      const otherProducts = this.userProductMatrix.get(similarUser.userId);
      
      for (const [productId, score] of otherProducts.entries()) {
        if (!userInteractions.has(productId)) {
          recommendations.push({
            product_id: productId,
            score: score * similarUser.similarity,
            type: 'collaborative',
            reason: 'Khách hàng tương tự cũng thích món này'
          });
        }
      }
    }

    return recommendations;
  }

  async getContentBasedRecs(userId, restaurantId) {
    // Get user's ordered products
    const [userProducts] = await pool.execute(`
      SELECT DISTINCT oi.product_id
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = ?
      AND o.restaurant_id = ?
      LIMIT 10
    `, [userId, restaurantId]);

    if (userProducts.length === 0) return [];

    // Get similar products based on category and tags
    const productIds = userProducts.map(p => p.product_id);
    const [similarProducts] = await pool.execute(`
      SELECT 
        p2.id as product_id,
        COUNT(DISTINCT p1.id) as common_customers,
        (CASE 
          WHEN p2.category IN (SELECT category FROM products WHERE id IN (?)) THEN 1 ELSE 0 
        END) as same_category,
        (CASE 
          WHEN p2.price BETWEEN 
            (SELECT AVG(price) * 0.7 FROM products WHERE id IN (?)) 
            AND (SELECT AVG(price) * 1.3 FROM products WHERE id IN (?)) 
          THEN 1 ELSE 0 
        END) as similar_price
      FROM products p1
      JOIN order_items oi1 ON p1.id = oi1.product_id
      JOIN orders o ON oi1.order_id = o.id
      JOIN order_items oi2 ON o.id = oi2.order_id
      JOIN products p2 ON oi2.product_id = p2.id
      WHERE p1.id IN (?)
      AND p2.id NOT IN (?)
      AND p2.restaurant_id = ?
      GROUP BY p2.id
      HAVING common_customers > 0
      ORDER BY common_customers DESC
      LIMIT 10
    `, [productIds, productIds, productIds, productIds, productIds, restaurantId]);

    return similarProducts.map(p => ({
      product_id: p.product_id,
      score: p.common_customers + p.same_category * 0.5 + p.similar_price * 0.3,
      type: 'content-based',
      reason: 'Tương tự với món bạn đã đặt'
    }));
  }

  async getPopularRecs(restaurantId, limit) {
    const [popular] = await pool.execute(`
      SELECT 
        p.id as product_id,
        COUNT(oi.id) as order_count,
        AVG(r.rating) as avg_rating,
        (COUNT(oi.id) * 0.6 + COALESCE(AVG(r.rating), 3) * 0.4) as score
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.restaurant_id = ?
      AND p.is_available = true
      GROUP BY p.id
      ORDER BY score DESC
      LIMIT ?
    `, [restaurantId, limit]);

    return popular.map(p => ({
      product_id: p.product_id,
      score: p.score,
      type: 'popular',
      reason: 'Món được yêu thích nhất'
    }));
  }
}

module.exports = new RecommendationService();