const express = require('express');
const router = express.Router();
const pool = require('../config/db');
router.get('/', async (req, res) => {
    try {
        const queryText = 'SELECT * FROM bookings ORDER BY booking_date DESC';
        const { rows } = await pool.query(queryText);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = 'SELECT * FROM bookings WHERE id = $1';
        const { rows } = await pool.query(queryText, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error fetching booking:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.post('/', async (req, res) => {
    const { itinerary_id, service_id, status, quantity, total_price } = req.body;

    if (!itinerary_id || !service_id || !total_price) {
        return res.status(400).json({ success: false, error: 'Missing required booking fields' });
    }

    try {
        const queryText = `
            INSERT INTO bookings (itinerary_id, service_id, status, quantity, total_price)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [itinerary_id, service_id, status || 'confirmed', quantity || 1, total_price];
        const { rows } = await pool.query(queryText, values);

        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error creating booking:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { status, quantity, total_price } = req.body;

    try {
        const queryText = `
            UPDATE bookings
            SET status = COALESCE($1, status),
                quantity = COALESCE($2, quantity),
                total_price = COALESCE($3, total_price)
            WHERE id = $4
            RETURNING *;
        `;
        const values = [status, quantity, total_price, id];
        const { rows } = await pool.query(queryText, values);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error updating booking:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = 'DELETE FROM bookings WHERE id = $1 RETURNING *';
        const { rows } = await pool.query(queryText, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (err) {
        console.error('Error deleting booking:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

module.exports = router;