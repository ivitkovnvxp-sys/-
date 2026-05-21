// TMS Freight Calculator - Backend API для PostgreSQL
// Установка: npm install express pg cors body-parser

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Раздача статических файлов

// PostgreSQL Connection Pool
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'tms_db',
  password: process.env.PGPASSWORD || '123',
  port: process.env.PGPORT || 5432,
});

// ============================================
// ORDERS API
// ============================================

// Инициализация таблиц БД
app.post('/api/db/init', async (req, res) => {
  try {
    // Таблица городов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tms_cities (
        city_name VARCHAR(100) PRIMARY KEY,
        region VARCHAR(100),
        terminal VARCHAR(200),
        transport_type VARCHAR(10) DEFAULT 'auto',
        mile1_type VARCHAR(20) DEFAULT 'fixed',
        mile1_price DECIMAL(10,2),
        mile1_type_agent VARCHAR(20),
        mile1_base_price DECIMAL(10,2),
        mile1_price_per_kg DECIMAL(10,2),
        mile1_agent VARCHAR(100),
        mile2_prices JSONB,
        mile2_type VARCHAR(20),
        mile2_base_price DECIMAL(10,2),
        mile2_price_per_kg DECIMAL(10,2),
        mile2_agent VARCHAR(100),
        mile3_type VARCHAR(20) DEFAULT 'fixed',
        mile3_price DECIMAL(10,2),
        mile3_type_agent VARCHAR(20),
        mile3_base_price DECIMAL(10,2),
        mile3_price_per_kg DECIMAL(10,2),
        mile3_agent VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Таблица агентов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tms_agents (
        agent_id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        region VARCHAR(100),
        cities TEXT[],
        city_tariff DECIMAL(10,2),
        remote_tariff DECIMAL(10,2),
        remote_cities_list TEXT[],
        remote_cities JSONB,
        tariffs JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Таблица связей городов и агентов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tms_cities_agents (
        id SERIAL PRIMARY KEY,
        city_name VARCHAR(100) NOT NULL,
        agent_id VARCHAR(100) NOT NULL,
        mile_position INTEGER CHECK (mile_position IN (1, 2, 3)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(city_name, agent_id, mile_position)
      )
    `);
    
    res.json({ success: true, message: 'База данных инициализирована' });
  } catch (error) {
    console.error('Ошибка инициализации БД:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === ГОРОДА ===

// Получить все города
app.get('/api/db/cities', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tms_cities ORDER BY city_name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Ошибка получения городов:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Сохранить город
app.post('/api/db/cities', async (req, res) => {
  try {
    const { city_name, ...data } = req.body;
    const fields = ['city_name', ...Object.keys(data)];
    const values = [city_name, ...Object.values(data)];
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const updateSet = Object.keys(data).map((k, i) => `${k} = $${i + 2}`).join(', ');
    
    const result = await pool.query(`
      INSERT INTO tms_cities (${fields.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (city_name) DO UPDATE SET ${updateSet}, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, values);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка сохранения города:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получить город
app.get('/api/db/cities/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    const result = await pool.query('SELECT * FROM tms_cities WHERE city_name = $1', [cityName]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Город не найден' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка получения города:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить город
app.put('/api/db/cities/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    const { ...data } = req.body;
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const updateSet = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
    
    const result = await pool.query(`
      UPDATE tms_cities 
      SET ${updateSet}, updated_at = CURRENT_TIMESTAMP
      WHERE city_name = $${fields.length + 1}
      RETURNING *
    `, [...values, cityName]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка обновления города:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Удалить город
app.delete('/api/db/cities/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    await pool.query('DELETE FROM tms_cities WHERE city_name = $1', [cityName]);
    res.json({ success: true, message: 'Город удалён' });
  } catch (error) {
    console.error('Ошибка удаления города:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === АГЕНТЫ ===

// Получить всех агентов
app.get('/api/db/agents', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tms_agents ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Ошибка получения агентов:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Сохранить агента
app.post('/api/db/agents', async (req, res) => {
  try {
    const { agent_id, ...data } = req.body;
    const fields = ['agent_id', ...Object.keys(data)];
    const values = [agent_id, ...Object.values(data)];
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const updateSet = Object.keys(data).map((k, i) => `${k} = $${i + 2}`).join(', ');
    
    const result = await pool.query(`
      INSERT INTO tms_agents (${fields.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (agent_id) DO UPDATE SET ${updateSet}, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, values);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка сохранения агента:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Обновить агента
app.put('/api/db/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { ...data } = req.body;
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const updateSet = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
    
    const result = await pool.query(`
      UPDATE tms_agents 
      SET ${updateSet}, updated_at = CURRENT_TIMESTAMP
      WHERE agent_id = $${fields.length + 1}
      RETURNING *
    `, [...values, agentId]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка обновления агента:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Удалить агента
app.delete('/api/db/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    await pool.query('DELETE FROM tms_agents WHERE agent_id = $1', [agentId]);
    res.json({ success: true, message: 'Агент удалён' });
  } catch (error) {
    console.error('Ошибка удаления агента:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === СВЯЗИ ГОРОДОВ И АГЕНТОВ ===

// Получить все связи
app.get('/api/db/cities-agents', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tms_cities_agents ORDER BY city_name, mile_position');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Ошибка получения связей:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Сохранить связь
app.post('/api/db/cities-agents', async (req, res) => {
  try {
    const { cityName, agentId, milePosition = 3 } = req.body;
    const result = await pool.query(`
      INSERT INTO tms_cities_agents (city_name, agent_id, mile_position)
      VALUES ($1, $2, $3)
      ON CONFLICT (city_name, agent_id, mile_position) DO NOTHING
      RETURNING *
    `, [cityName, agentId, milePosition]);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка сохранения связи:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Удалить связь
app.delete('/api/db/cities-agents', async (req, res) => {
  try {
    const { city, agent } = req.query;
    await pool.query('DELETE FROM tms_cities_agents WHERE city_name = $1 AND agent_id = $2', [city, agent]);
    res.json({ success: true, message: 'Связь удалена' });
  } catch (error) {
    console.error('Ошибка удаления связи:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ORDERS API
// ============================================

// GET /api/orders - Получить все заявки
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/orders/:id - Получить заявку по ID
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/orders - Создать новую заявку
app.post('/api/orders', async (req, res) => {
  try {
    const {
      client_id,
      client_name,
      order_type,
      cargo_type,
      weight_kg,
      volume_m3,
      notes,
      pickup_address,
      pickup_lat,
      pickup_lon,
      pickup_contact,
      pickup_phone,
      pickup_instructions,
      delivery_address,
      delivery_lat,
      delivery_lon,
      delivery_contact,
      delivery_phone,
      delivery_instructions,
      pickup_datetime,
      delivery_deadline,
      priority,
      price,
      metadata
    } = req.body;

    const result = await pool.query(`
      INSERT INTO orders (
        client_id, client_name, order_type, cargo_type, weight_kg, volume_m3, notes,
        pickup_address, pickup_lat, pickup_lon, pickup_contact, pickup_phone, pickup_instructions,
        delivery_address, delivery_lat, delivery_lon, delivery_contact, delivery_phone, delivery_instructions,
        pickup_datetime, delivery_deadline, priority, price, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *
    `, [
      client_id, client_name, order_type, cargo_type, weight_kg, volume_m3, notes,
      pickup_address, pickup_lat, pickup_lon, pickup_contact, pickup_phone, pickup_instructions,
      delivery_address, delivery_lat, delivery_lon, delivery_contact, delivery_phone, delivery_instructions,
      pickup_datetime, delivery_deadline, priority, price, metadata
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/orders/:id - Обновить заявку
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Build dynamic update query
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    
    const query = `
      UPDATE orders 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;
    
    const result = await pool.query(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/orders/:id - Удалить заявку
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================
// CLIENTS API
// ============================================

// GET /api/clients - Получить всех клиентов
app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/clients/search?q=query - Поиск клиентов
app.get('/api/clients/search', async (req, res) => {
  try {
    const { q } = req.query;
    const result = await pool.query(
      'SELECT * FROM clients WHERE name ILIKE $1 OR company_name ILIKE $1 OR email ILIKE $1',
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/clients - Создать клиента
app.post('/api/clients', async (req, res) => {
  try {
    const { name, company_name, inn, phone, email, address, contact_person, notes } = req.body;
    
    const result = await pool.query(`
      INSERT INTO clients (name, company_name, inn, phone, email, address, contact_person, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, company_name, inn, phone, email, address, contact_person, notes]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================
// VEHICLES API
// ============================================

// GET /api/vehicles - Получить все транспортные средства
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY plate_number');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/vehicles/available - Получить доступные транспортные средства
app.get('/api/vehicles/available', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM vehicles WHERE status = 'available'");
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching available vehicles:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/vehicles/:id - Обновить транспортное средство
app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    
    const query = `
      UPDATE vehicles 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;
    
    const result = await pool.query(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================
// REPORTS API
// ============================================

// GET /api/reports?start=YYYY-MM-DD&end=YYYY-MM-DD - Получить отчет
app.get('/api/reports', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    // Получаем заявки за период
    const ordersResult = await pool.query(`
      SELECT * FROM orders 
      WHERE DATE(created_at) BETWEEN $1 AND $2
      ORDER BY created_at DESC
    `, [start, end]);

    // Получаем статистику
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'new') AS new_orders,
        COUNT(*) FILTER (WHERE status = 'planned') AS planned_orders,
        COUNT(*) FILTER (WHERE status = 'in_transit') AS in_transit,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE priority = 'urgent') AS urgent
      FROM orders
      WHERE DATE(created_at) BETWEEN $1 AND $2
    `, [start, end]);

    res.json({
      orders: ordersResult.rows,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/reports/daily - Получить дневную статистику
app.get('/api/reports/daily', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM v_daily_statistics 
      LIMIT 30
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily statistics:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/reports/vehicle-utilization - Получить статистику по транспорту
app.get('/api/reports/vehicle-utilization', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM v_vehicle_utilization
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicle utilization:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`TMS Backend running at http://localhost:${port}`);
  console.log('Database connected successfully');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
