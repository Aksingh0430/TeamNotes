// server/routes/notes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const log = require('../utils/log'); // <- debug logger

async function hasAccess(noteId, userId) {
  const q = `
    SELECT n.owner_id,
           (SELECT can_edit FROM note_shares s WHERE s.note_id = n.id AND s.user_id = $2 LIMIT 1) as can_edit
    FROM notes n
    WHERE n.id = $1
  `;
  const r = await db.query(q, [noteId, userId]);
  if (!r.rows[0]) return null;
  return { owner_id: r.rows[0].owner_id, can_edit: r.rows[0].can_edit };
}

// Create note
router.post('/', auth, async (req, res) => {
  const { title, content } = req.body;
  const owner_id = req.user.id;
  try {
    log('API: POST /api/notes create by', owner_id);
    const result = await db.query(
      `INSERT INTO notes (owner_id, title, content) VALUES ($1,$2,$3) RETURNING *`,
      [owner_id, title, content]
    );
    const note = result.rows[0];
    await db.query(
      'INSERT INTO note_versions (note_id, content, title, editor_id) VALUES ($1,$2,$3,$4)',
      [note.id, content, title, owner_id]
    );
    await db.query(
      'INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)',
      [owner_id, note.id, 'create_note', JSON.stringify({ title })]
    );
    res.json(note);
  } catch (err) {
    console.error('create note error', err);
    res.status(500).json({ error: 'Failed to create note', details: err.message });
  }
});

// List my notes + shared
router.get('/', auth, async (req, res) => {
  const uid = req.user.id;
  try {
    log('API: GET /api/notes list for', uid);
    const { rows } = await db.query(
      `SELECT DISTINCT n.* FROM notes n LEFT JOIN note_shares s ON n.id = s.note_id
       WHERE n.owner_id=$1 OR s.user_id=$1 ORDER BY n.updated_at DESC`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error('list notes error', err);
    res.status(500).json({ error: 'Failed to fetch notes', details: err.message });
  }
});

// Get single note with permission check (returns permission metadata)
router.get('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const uid = req.user.id;
  try {
    log('API: GET /api/notes/' + id + ' by', uid);

    // get owner and user's share permission (if any)
    const access = await hasAccess(id, uid);
    if (!access) return res.status(404).json({ error: 'Not found' });

    // if not owner, ensure there's a share row and fetch can_edit
    if (access.owner_id !== uid) {
      const s = await db.query('SELECT can_edit FROM note_shares WHERE note_id=$1 AND user_id=$2', [id, uid]);
      if (s.rowCount === 0) return res.status(403).json({ error: 'Forbidden' });
      access.can_edit = s.rows[0].can_edit;
    }

    const { rows } = await db.query('SELECT * FROM notes WHERE id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    const note = rows[0];

    // Determine boolean flags for client:
    const is_owner = access.owner_id === uid;
    const can_edit_for_user = !!(is_owner || access.can_edit);

    // Return note plus permission metadata
    res.json({
      ...note,
      permission: {
        is_owner,
        can_edit: can_edit_for_user
      }
    });
  } catch (err) {
    console.error('get note error', err);
    res.status(500).json({ error: 'Failed to fetch note', details: err.message });
  }
});

// Update note (and create version)
router.put('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, content } = req.body;
  const uid = req.user.id;
  try {
    log('API: PUT /api/notes/' + id + ' by', uid);
    const access = await hasAccess(id, uid);
    if (!access) return res.status(404).json({ error: 'Not found' });

    // owner or shared with can_edit
    if (access.owner_id !== uid && !access.can_edit) return res.status(403).json({ error: 'Forbidden' });

    const result = await db.query(
      'UPDATE notes SET title=$1, content=$2, updated_at=now() WHERE id=$3 RETURNING *',
      [title, content, id]
    );
    await db.query(
      'INSERT INTO note_versions (note_id, content, title, editor_id) VALUES ($1,$2,$3,$4)',
      [id, content, title, uid]
    );
    await db.query(
      'INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)',
      [uid, id, 'update_note', JSON.stringify({ title })]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('update note error', err);
    res.status(500).json({ error: 'Failed to update note', details: err.message });
  }
});

// Delete note (owner only)
router.delete('/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const uid = req.user.id;
  try {
    log('API: DELETE /api/notes/' + id + ' by', uid);
    const { rows } = await db.query('SELECT owner_id FROM notes WHERE id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Note not found' });
    if (rows[0].owner_id !== uid) return res.status(403).json({ error: 'Only owner can delete' });

    await db.query('DELETE FROM notes WHERE id=$1', [id]);
    await db.query(
      'INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)',
      [uid, id, 'delete_note', JSON.stringify({ note_id: id })]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('delete note error', err);
    res.status(500).json({ error: 'Failed to delete note', details: err.message });
  }
});

// --- Sharing endpoints ---

// Share note (create or update)
router.post('/:id/share', auth, async (req, res) => {
  const note_id = req.params.id;
  const { email, can_edit } = req.body;
  const uid = req.user.id;
  try {
    log('API: POST /api/notes/' + note_id + '/share by user', uid, '->', email);
    const owner = await db.query('SELECT owner_id FROM notes WHERE id=$1', [note_id]);
    if (!owner.rows[0]) return res.status(404).json({ error: 'Note not found' });
    if (owner.rows[0].owner_id !== uid) return res.status(403).json({ error: 'Only owner can share' });

    const userRes = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });
    const user_id = userRes.rows[0].id;

    // Upsert share
    await db.query(
      `INSERT INTO note_shares (note_id,user_id,can_edit) VALUES ($1,$2,$3)
       ON CONFLICT (note_id, user_id) DO UPDATE SET can_edit = EXCLUDED.can_edit, granted_at = now()`,
      [note_id, user_id, !!can_edit]
    );
    await db.query(
      'INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)',
      [uid, note_id, 'share_note', JSON.stringify({ to: user_id, can_edit: !!can_edit })]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('share note error', err);
    res.status(500).json({ error: 'Failed to share note', details: err.message });
  }
});

// List shares for a note (owner only)
router.get('/:id/shares', auth, async (req, res) => {
  const note_id = req.params.id;
  const uid = req.user.id;
  try {
    log('API: GET /api/notes/' + note_id + '/shares called by user', uid);
    const owner = await db.query('SELECT owner_id FROM notes WHERE id=$1', [note_id]);
    if (!owner.rows[0]) return res.status(404).json({ error: 'Note not found' });
    if (owner.rows[0].owner_id !== uid) return res.status(403).json({ error: 'Only owner can view shares' });

    const { rows } = await db.query(
      `SELECT s.user_id, s.can_edit, u.email, u.name, s.granted_at FROM note_shares s JOIN users u ON s.user_id = u.id WHERE s.note_id=$1`,
      [note_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('list shares error', err);
    res.status(500).json({ error: 'Failed to list shares', details: err.message });
  }
});

// Update share (permission)
router.put('/:id/shares', auth, async (req, res) => {
  const note_id = req.params.id;
  const { user_id, can_edit } = req.body;
  const uid = req.user.id;
  try {
    log('API: PUT /api/notes/' + note_id + '/shares by', uid, 'target user', user_id, 'can_edit', can_edit);
    const owner = await db.query('SELECT owner_id FROM notes WHERE id=$1', [note_id]);
    if (!owner.rows[0]) return res.status(404).json({ error: 'Note not found' });
    if (owner.rows[0].owner_id !== uid) return res.status(403).json({ error: 'Only owner can update shares' });

    await db.query('UPDATE note_shares SET can_edit=$1 WHERE note_id=$2 AND user_id=$3', [!!can_edit, note_id, user_id]);
    await db.query(
      'INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)',
      [uid, note_id, 'update_share', JSON.stringify({ user_id, can_edit: !!can_edit })]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('update share error', err);
    res.status(500).json({ error: 'Failed to update share', details: err.message });
  }
});

// Revoke share
router.delete('/:id/shares/:userId', auth, async (req, res) => {
  const note_id = req.params.id;
  const userId = req.params.userId;
  const uid = req.user.id;
  try {
    log('API: DELETE /api/notes/' + note_id + '/shares/' + userId + ' by', uid);
    const owner = await db.query('SELECT owner_id FROM notes WHERE id=$1', [note_id]);
    if (!owner.rows[0]) return res.status(404).json({ error: 'Note not found' });
    if (owner.rows[0].owner_id !== uid) return res.status(403).json({ error: 'Only owner can revoke' });

    await db.query('DELETE FROM note_shares WHERE note_id=$1 AND user_id=$2', [note_id, userId]);
    await db.query(
      'INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)',
      [uid, note_id, 'revoke_share', JSON.stringify({ user_id: userId })]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('revoke share error', err);
    res.status(500).json({ error: 'Failed to revoke share', details: err.message });
  }
});

// --- Version history endpoints ---

// List versions for a note
router.get('/:id/versions', auth, async (req, res) => {
  const note_id = req.params.id;
  try {
    log('API: GET /api/notes/' + note_id + '/versions called by user', req.user && req.user.id);
    const { rows } = await db.query(
      'SELECT id, title, content, versioned_at, editor_id FROM note_versions WHERE note_id=$1 ORDER BY versioned_at DESC',
      [note_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('list versions error', err);
    res.status(500).json({ error: 'Failed to list versions', details: err.message });
  }
});

// Revert to a version (create new version entry and update note content/title)
router.post('/:id/versions/:versionId/revert', auth, async (req, res) => {
  const note_id = req.params.id;
  const versionId = req.params.versionId;
  const uid = req.user.id;
  try {
    log('API: POST /api/notes/' + note_id + '/versions/' + versionId + '/revert by', uid);
    // Check permission: owner or can_edit
    const perm = await db.query(
      `SELECT 1 FROM notes n LEFT JOIN note_shares s ON n.id = s.note_id
       WHERE n.id=$1 AND (n.owner_id=$2 OR (s.user_id=$2 AND s.can_edit))`,
      [note_id, uid]
    );
    if (perm.rowCount === 0) return res.status(403).json({ error: 'Forbidden' });

    const v = await db.query('SELECT title, content FROM note_versions WHERE id=$1 AND note_id=$2', [versionId, note_id]);
    if (!v.rows[0]) return res.status(404).json({ error: 'Version not found' });
    const { title, content } = v.rows[0];

    const r = await db.query(
      'UPDATE notes SET title=$1, content=$2, updated_at=now() WHERE id=$3 RETURNING *',
      [title, content, note_id]
    );
    await db.query(
      'INSERT INTO note_versions (note_id, content, title, editor_id) VALUES ($1,$2,$3,$4)',
      [note_id, content, title, uid]
    );
    await db.query(
      'INSERT INTO activity_log (user_id,note_id,action,payload) VALUES ($1,$2,$3,$4)',
      [uid, note_id, 'revert_note_version', JSON.stringify({ versionId })]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error('revert version error', err);
    res.status(500).json({ error: 'Failed to revert version', details: err.message });
  }
});

module.exports = router;
