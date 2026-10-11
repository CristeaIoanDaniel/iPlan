const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const { validate } = require('../middleware/validate.middleware');
const {
    createItinerarySchema,
    updateItinerarySchema,
    itineraryIdSchema,
} = require('../schemas/itinerary.schema');
const {
    addCollaboratorSchema,
    updateCollaboratorSchema,
    itineraryCollaboratorsSchema,
    removeCollaboratorSchema,
} = require('../schemas/itinerary-collaborator.schema');
const {
    createItemSchema,
    updateItemSchema,
    itineraryItemsSchema,
    itemParamsSchema,
} = require('../schemas/itinerary-item.schema');
const {
    authenticate,
    optionalAuthenticate,
} = require('../middleware/auth.middleware');

const findAccessibleItinerary = async (itineraryId, userId) => {
    const { rows } = await pool.query(
        `SELECT i.*, c.role AS collaborator_role
         FROM itineraries i
         LEFT JOIN itinerary_collaborators c
           ON c.itinerary_id = i.id AND c.user_id = $2
         WHERE i.id = $1
           AND (i.is_public = TRUE OR i.user_id = $2 OR c.user_id = $2)`,
        [itineraryId, userId],
    );
    return rows[0];
};

const requireItineraryOwner = async (itineraryId, userId, res) => {
    const { rows } = await pool.query(
        'SELECT id FROM itineraries WHERE id = $1 AND user_id = $2',
        [itineraryId, userId],
    );
    if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Itinerary not found' });
        return false;
    }
    return true;
};

const getItineraryContext = async (itineraryId, userId) => {
    const { rows } = await pool.query(
        `SELECT i.id, i.user_id, i.is_public, i.start_date, i.end_date,
                c.role AS collaborator_role
         FROM itineraries i
         LEFT JOIN itinerary_collaborators c
           ON c.itinerary_id = i.id AND c.user_id = $2
         WHERE i.id = $1`,
        [itineraryId, userId],
    );
    return rows[0];
};

const canViewItinerary = (itinerary, userId) => Boolean(
    itinerary && (
        itinerary.is_public
        || itinerary.user_id === userId
        || itinerary.collaborator_role
    ),
);

const canEditItinerary = (itinerary, userId) => Boolean(
    itinerary && (
        itinerary.user_id === userId
        || itinerary.collaborator_role === 'editor'
    ),
);

const isItemWithinItineraryDates = (item, itinerary) => {
    if (item.type === 'note') return true;

    const itineraryStart = new Date(`${String(itinerary.start_date).slice(0, 10)}T00:00:00.000Z`);
    const itineraryEndExclusive = new Date(`${String(itinerary.end_date).slice(0, 10)}T00:00:00.000Z`);
    itineraryEndExclusive.setUTCDate(itineraryEndExclusive.getUTCDate() + 1);
    const itemStart = new Date(item.starts_at);
    const itemEnd = new Date(item.ends_at);

    return itemStart >= itineraryStart
        && itemEnd > itemStart
        && itemEnd < itineraryEndExclusive;
};

router.get('/', optionalAuthenticate, async (req, res) => {
    try {
        const queryText = `
            SELECT DISTINCT i.*
            FROM itineraries i
            LEFT JOIN itinerary_collaborators c
              ON c.itinerary_id = i.id AND c.user_id = $1
            WHERE i.is_public = TRUE OR i.user_id = $1 OR c.user_id = $1
            ORDER BY i.created_at DESC
        `;
        const { rows } = await pool.query(queryText, [req.user?.id || null]);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error('Error fetching itineraries:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.get('/:id', optionalAuthenticate, validate(itineraryIdSchema), async (req, res) => {
    const { id } = req.params;
    try {
        const itinerary = await findAccessibleItinerary(id, req.user?.id || null);
        if (!itinerary) {
            return res.status(404).json({ success: false, error: 'Itinerary not found' });
        }

        res.json({ success: true, data: itinerary });
    } catch (err) {
        console.error('Error fetching itinerary:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.get(
    '/:id/collaborators',
    authenticate,
    validate(itineraryCollaboratorsSchema),
    async (req, res) => {
        const { id } = req.params;
        try {
            if (!(await requireItineraryOwner(id, req.user.id, res))) return;

            const { rows } = await pool.query(
                `SELECT c.user_id, u.name, u.email, c.role, c.created_at
                 FROM itinerary_collaborators c
                 JOIN users u ON u.id = c.user_id
                 WHERE c.itinerary_id = $1
                 ORDER BY c.created_at`,
                [id],
            );
            res.json({ success: true, count: rows.length, data: rows });
        } catch (err) {
            console.error('Error listing itinerary collaborators:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

router.post(
    '/:id/collaborators',
    authenticate,
    validate(addCollaboratorSchema),
    async (req, res) => {
        const { id } = req.params;
        const { email, role } = req.body;
        try {
            if (!(await requireItineraryOwner(id, req.user.id, res))) return;

            const { rows: users } = await pool.query(
                'SELECT id, name, email FROM users WHERE email = $1',
                [email],
            );
            if (users.length === 0) {
                return res.status(404).json({ success: false, error: 'Registered user not found' });
            }
            if (users[0].id === req.user.id) {
                return res.status(400).json({ success: false, error: 'Owner cannot be added as a collaborator' });
            }

            const { rows } = await pool.query(
                `INSERT INTO itinerary_collaborators (itinerary_id, user_id, role)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (itinerary_id, user_id) DO NOTHING
                 RETURNING user_id, role, created_at`,
                [id, users[0].id, role],
            );
            if (rows.length === 0) {
                return res.status(409).json({ success: false, error: 'User is already a collaborator' });
            }

            res.status(201).json({
                success: true,
                data: { ...rows[0], name: users[0].name, email: users[0].email },
            });
        } catch (err) {
            console.error('Error adding itinerary collaborator:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

router.patch(
    '/:id/collaborators/:userId',
    authenticate,
    validate(updateCollaboratorSchema),
    async (req, res) => {
        const { id, userId } = req.params;
        try {
            if (!(await requireItineraryOwner(id, req.user.id, res))) return;

            const { rows } = await pool.query(
                `UPDATE itinerary_collaborators
                 SET role = $3
                 WHERE itinerary_id = $1 AND user_id = $2
                 RETURNING user_id, role, created_at`,
                [id, userId, req.body.role],
            );
            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Collaborator not found' });
            }
            res.json({ success: true, data: rows[0] });
        } catch (err) {
            console.error('Error updating itinerary collaborator:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

router.delete(
    '/:id/collaborators/:userId',
    authenticate,
    validate(removeCollaboratorSchema),
    async (req, res) => {
        const { id, userId } = req.params;
        try {
            if (!(await requireItineraryOwner(id, req.user.id, res))) return;

            const { rows } = await pool.query(
                `DELETE FROM itinerary_collaborators
                 WHERE itinerary_id = $1 AND user_id = $2
                 RETURNING user_id`,
                [id, userId],
            );
            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Collaborator not found' });
            }
            res.json({ success: true, message: 'Collaborator removed successfully' });
        } catch (err) {
            console.error('Error removing itinerary collaborator:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

router.post('/', authenticate,validate(createItinerarySchema),async (req, res) => {
    const { title, description, destination, start_date, end_date } = req.body;

    if (!title || !destination) {
        return res.status(400).json({ success: false, error: 'Title and destination are required' });
    }

    try {
        const queryText = `
            INSERT INTO itineraries (user_id, title, description, destination, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const values = [req.user.id, title, description, destination, start_date, end_date];
        const { rows } = await pool.query(queryText, values);

        res.status(201).json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error creating itinerary:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.put('/:id', authenticate, validate(updateItinerarySchema), async (req, res) => {
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
            AND (
                user_id = $7
                OR EXISTS (
                    SELECT 1
                    FROM itinerary_collaborators
                    WHERE itinerary_id = $6 AND user_id = $7 AND role = 'editor'
                )
            )
            AND NOT EXISTS (
                SELECT 1
                FROM itinerary_items item
                WHERE item.itinerary_id = itineraries.id
                  AND item.item_type IN ('flight', 'hotel', 'activity')
                  AND (
                    item.starts_at < COALESCE($4::date, itineraries.start_date)::timestamptz
                    OR item.ends_at >= (COALESCE($5::date, itineraries.end_date) + 1)::timestamptz
                  )
            )
            RETURNING *;
        `;
        const values = [title, description, destination, start_date, end_date, id, req.user.id];
        const { rows } = await pool.query(queryText, values);

        if (rows.length === 0) {
            const { rows: editableItineraries } = await pool.query(
                `SELECT id FROM itineraries
                 WHERE id = $1
                   AND (
                     user_id = $2
                     OR EXISTS (
                       SELECT 1 FROM itinerary_collaborators
                       WHERE itinerary_id = $1 AND user_id = $2 AND role = 'editor'
                     )
                   )`,
                [id, req.user.id],
            );
            if (editableItineraries.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'Itinerary dates conflict with existing item dates',
                });
            }
            return res.status(404).json({ success: false, error: 'Itinerary not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error('Error updating itinerary:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});
router.delete('/:id', authenticate, validate(itineraryIdSchema), async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = 'DELETE FROM itineraries WHERE id = $1 AND user_id=$2 RETURNING *';
        const { rows } = await pool.query(queryText, [id,req.user.id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Itinerary not found' });
        }

        res.json({ success: true, message: 'Itinerary deleted successfully' });
    } catch (err) {
        console.error('Error deleting itinerary:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.get(
    '/:id/items',
    optionalAuthenticate,
    validate(itineraryItemsSchema),
    async (req, res) => {
        const { id } = req.params;
        try {
            const itinerary = await getItineraryContext(id, req.user?.id || null);
            if (!canViewItinerary(itinerary, req.user?.id || null)) {
                return res.status(404).json({ success: false, error: 'Itinerary not found' });
            }

            const { rows } = await pool.query(
                `SELECT id, itinerary_id, item_type, title, description, starts_at, ends_at,
                        created_at, updated_at
                 FROM itinerary_items
                 WHERE itinerary_id = $1
                 ORDER BY starts_at NULLS LAST, created_at`,
                [id],
            );
            res.json({ success: true, count: rows.length, data: rows });
        } catch (err) {
            console.error('Error listing itinerary items:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

router.post(
    '/:id/items',
    authenticate,
    validate(createItemSchema),
    async (req, res) => {
        const { id } = req.params;
        const item = req.body;
        try {
            const itinerary = await getItineraryContext(id, req.user.id);
            if (!canEditItinerary(itinerary, req.user.id)) {
                return res.status(404).json({ success: false, error: 'Itinerary not found' });
            }
            if (!isItemWithinItineraryDates(item, itinerary)) {
                return res.status(400).json({
                    success: false,
                    error: 'Item dates must fall within the itinerary date range',
                });
            }

            const { rows } = await pool.query(
                `INSERT INTO itinerary_items
                    (itinerary_id, item_type, title, description, starts_at, ends_at)
                 SELECT $1, $2, $3, $4, $5, $6
                 FROM itineraries i
                 WHERE i.id = $1
                   AND (
                     i.user_id = $7
                     OR EXISTS (
                       SELECT 1 FROM itinerary_collaborators c
                       WHERE c.itinerary_id = i.id AND c.user_id = $7 AND c.role = 'editor'
                     )
                   )
                   AND (
                     $2 = 'note'
                     OR ($5::timestamptz >= i.start_date::timestamptz
                         AND $6::timestamptz < (i.end_date + 1)::timestamptz)
                   )
                 RETURNING *`,
                [id, item.type, item.title, item.description || null,
                    item.starts_at || null, item.ends_at || null, req.user.id],
            );
            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Itinerary not found' });
            }
            res.status(201).json({ success: true, data: rows[0] });
        } catch (err) {
            console.error('Error creating itinerary item:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

router.get(
    '/:id/items/:itemId',
    optionalAuthenticate,
    validate(itemParamsSchema),
    async (req, res) => {
        const { id, itemId } = req.params;
        try {
            const itinerary = await getItineraryContext(id, req.user?.id || null);
            if (!canViewItinerary(itinerary, req.user?.id || null)) {
                return res.status(404).json({ success: false, error: 'Itinerary item not found' });
            }

            const { rows } = await pool.query(
                `SELECT id, itinerary_id, item_type, title, description, starts_at, ends_at,
                        created_at, updated_at
                 FROM itinerary_items
                 WHERE itinerary_id = $1 AND id = $2`,
                [id, itemId],
            );
            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Itinerary item not found' });
            }
            res.json({ success: true, data: rows[0] });
        } catch (err) {
            console.error('Error fetching itinerary item:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

router.put(
    '/:id/items/:itemId',
    authenticate,
    validate(updateItemSchema),
    async (req, res) => {
        const { id, itemId } = req.params;
        try {
            const itinerary = await getItineraryContext(id, req.user.id);
            if (!canEditItinerary(itinerary, req.user.id)) {
                return res.status(404).json({ success: false, error: 'Itinerary item not found' });
            }

            const { rows: existingRows } = await pool.query(
                'SELECT * FROM itinerary_items WHERE itinerary_id = $1 AND id = $2',
                [id, itemId],
            );
            const existing = existingRows[0];
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Itinerary item not found' });
            }

            const item = {
                type: existing.item_type,
                starts_at: req.body.starts_at ?? existing.starts_at,
                ends_at: req.body.ends_at ?? existing.ends_at,
            };
            if (!isItemWithinItineraryDates(item, itinerary)) {
                return res.status(400).json({
                    success: false,
                    error: 'Item dates must fall within the itinerary date range',
                });
            }

            const { rows } = await pool.query(
                `UPDATE itinerary_items ii
                 SET title = COALESCE($1, ii.title),
                     description = COALESCE($2, ii.description),
                     starts_at = COALESCE($3, ii.starts_at),
                     ends_at = COALESCE($4, ii.ends_at),
                     updated_at = NOW()
                 FROM itineraries i
                 WHERE ii.id = $5 AND ii.itinerary_id = $6 AND i.id = ii.itinerary_id
                   AND (
                     i.user_id = $7
                     OR EXISTS (
                       SELECT 1 FROM itinerary_collaborators c
                       WHERE c.itinerary_id = i.id AND c.user_id = $7 AND c.role = 'editor'
                     )
                   )
                   AND (
                     ii.item_type = 'note'
                     OR (COALESCE($3::timestamptz, ii.starts_at) >= i.start_date::timestamptz
                         AND COALESCE($4::timestamptz, ii.ends_at) < (i.end_date + 1)::timestamptz)
                   )
                 RETURNING ii.*`,
                [req.body.title ?? null, req.body.description ?? null,
                    req.body.starts_at ?? null, req.body.ends_at ?? null,
                    itemId, id, req.user.id],
            );
            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Itinerary item not found' });
            }
            res.json({ success: true, data: rows[0] });
        } catch (err) {
            console.error('Error updating itinerary item:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

router.delete(
    '/:id/items/:itemId',
    authenticate,
    validate(itemParamsSchema),
    async (req, res) => {
        const { id, itemId } = req.params;
        try {
            const { rows } = await pool.query(
                `DELETE FROM itinerary_items ii
                 USING itineraries i
                 WHERE ii.id = $1 AND ii.itinerary_id = $2 AND i.id = ii.itinerary_id
                   AND (
                     i.user_id = $3
                     OR EXISTS (
                       SELECT 1 FROM itinerary_collaborators c
                       WHERE c.itinerary_id = i.id AND c.user_id = $3 AND c.role = 'editor'
                     )
                   )
                 RETURNING ii.id`,
                [itemId, id, req.user.id],
            );
            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Itinerary item not found' });
            }
            res.json({ success: true, message: 'Itinerary item deleted successfully' });
        } catch (err) {
            console.error('Error deleting itinerary item:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    },
);

module.exports = router;