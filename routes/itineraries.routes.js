const express = require('express');
const router = express.Router();
const pool = require('../config/db');
router.get('/', async (req, res) => {
    try {
        const queryText = 'SELECT * FROM itineraries ORDER BY created_at DESC';
        const { rows } = await pool.query(queryText);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error('Error fetching itineraries:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = 'SELECT * FROM itineraries WHERE id = $1';
        const { rows } = await pool.query(queryText, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Itinerary not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error fetching itinerary:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.post('/', async (req, res) => {
    const { title, description, destination, start_date, end_date } = req.body;

    if (!title || !destination) {
        return res.status(400).json({ success: false, error: 'Title and destination are required' });
    }

    try {
        const queryText = `
            INSERT INTO itineraries (title, description, destination, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [title, description, destination, start_date, end_date];
        const { rows } = await pool.query(queryText, values);

        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error creating itinerary:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, destination, start_date, end_date } = req.body;

    try {
        const queryText = `
            UPDATE itineraries
            SET title = COALESCE($1, title),
                description = COALESCE($2, description),
                destination = COALESCE($3, destination),
                start_date = COALESCE($4, start_date),
                end_date = COALESCE($5, end_date)
            WHERE id = $6
            RETURNING *;
        `;
        const values = [title, description, destination, start_date, end_date, id];
        const { rows } = await pool.query(queryText, values);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Itinerary not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error updating itinerary:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = 'DELETE FROM itineraries WHERE id = $1 RETURNING *';
        const { rows } = await pool.query(queryText, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Itinerary not found' });
        }

        res.json({ success: true, message: 'Itinerary deleted successfully' });
    } catch (err) {
        console.error('Error deleting itinerary:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

module.exports = router;