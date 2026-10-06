const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
router.get('/', async (req, res, next) => {
  try {
    const { location, category } = req.query;
    let query = 'SELECT * FROM services WHERE 1=1';
    const params = [];

    if (location) {
      params.push(`%${location}%`);
      query += ` AND location ILIKE $${params.length}`;
    }

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ status: 'success', results: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
});
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM services WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Service not found' });
    }

    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
router.post('/', async (req, res, next) => {
  try {
    const { title, description, category, location, price } = req.body;
    
    const query = `
      INSERT INTO services (title, description, category, location, price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [title, description, category, location, price];

    const result = await pool.query(query, values);
    res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, category, location, price } = req.body;

    const query = `
      UPDATE services 
      SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        location = COALESCE($4, location),
        price = COALESCE($5, price),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const values = [title, description, category, location, price, id];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Service not found' });
    }

    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM services WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Service not found' });
    }

    res.json({ status: 'success', message: 'Service deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;