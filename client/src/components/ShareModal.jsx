import React, { useState, useEffect } from 'react';
import API from '../api';

export default function ShareModal({ noteId, onClose, onShared }) {
  // Defensive: if noteId is missing we show a friendly message instead of crashing
  const [email, setEmail] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    // only fetch when a valid noteId is present
    if (!noteId) {
      setShares([]);
      return;
    }
    fetchShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function fetchShares() {
    if (!noteId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data } = await API.get(`/notes/${noteId}/shares`);
      setShares(data || []);
    } catch (err) {
      console.error('fetchShares error', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to load shares';
      setErrorMsg(msg);
      setShares([]);
    } finally {
      setLoading(false);
    }
  }

  async function share() {
    setErrorMsg(null);

    // defensive checks
    if (!noteId) {
      setErrorMsg('Note ID is missing. Save or reload the note and try again.');
      return;
    }
    if (!email || typeof email !== 'string') {
      setErrorMsg('Please enter a valid email to share with.');
      return;
    }

    setLoading(true);
    try {
      await API.post(`/notes/${noteId}/share`, { email, can_edit: canEdit });
      setEmail('');
      setCanEdit(false);
      await fetchShares();
      try {
        onShared && onShared();
      } catch (cbErr) {
        console.error('onShared callback threw', cbErr);
        setErrorMsg('Shared but UI update failed. Check console.');
      }
      // small success ack — use alert for now
      alert('Shared successfully');
    } catch (e) {
      console.error('Share failed:', e);
      const status = e?.response?.status;
      const body = e?.response?.data;
      const friendly = body?.error || body?.details || e?.message || 'Share failed';
      setErrorMsg(`Share failed${status ? ` (status ${status})` : ''}: ${friendly}`);
    } finally {
      setLoading(false);
    }
  }

  async function revoke(user_id) {
    if (!noteId || !user_id) return;
    if (!confirm('Revoke share?')) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      await API.delete(`/notes/${noteId}/shares/${user_id}`);
      await fetchShares();
      try { onShared && onShared(); } catch(e){ console.error('onShared threw', e) }
    } catch (e) {
      console.error('Revoke failed', e);
      setErrorMsg(e?.response?.data?.error || e?.message || 'Revoke failed');
    } finally {
      setLoading(false);
    }
  }

  async function togglePerm(user_id, current) {
    if (!noteId || !user_id) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      await API.put(`/notes/${noteId}/shares`, { user_id, can_edit: !current });
      await fetchShares();
    } catch (e) {
      console.error('Toggle permission failed', e);
      setErrorMsg(e?.response?.data?.error || e?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  // Render a safe UI (won't crash even if noteId is undefined)
  return (
    <div style={{ border: '1px solid #ddd', padding: 12, background: '#fff', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Share Note</h4>
        <div>
          <button onClick={onClose} style={{ marginLeft: 8 }}>Close</button>
        </div>
      </div>

      {!noteId ? (
        <div style={{ marginTop: 12, color: '#9ca3af' }}>
          Note not selected or not saved yet. Save the note first, then open Share.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}
              placeholder="user email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} disabled={loading} />
              <span style={{ fontSize: 13 }}>Can edit</span>
            </label>
            <button onClick={share} disabled={loading} style={{ padding: '8px 12px', borderRadius: 6 }}>
              {loading ? 'Working…' : 'Share'}
            </button>
          </div>

          {errorMsg && <div style={{ marginTop: 8, color: 'crimson' }}>{errorMsg}</div>}
          <div style={{ marginTop: 12 }}>
            <h5 style={{ margin: '8px 0' }}>Current shares</h5>
            {loading && <div style={{ color: '#6b7280' }}>Loading…</div>}
            {!loading && shares.length === 0 && <div style={{ color: '#6b7280' }}>Not shared</div>}
            {!loading && shares.length > 0 && (
              <ul style={{ paddingLeft: 16 }}>
                {shares.map((s) => (
                  <li key={s.user_id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.name || s.email}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{s.can_edit ? 'editor' : 'viewer'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => togglePerm(s.user_id, s.can_edit)} disabled={loading} style={{ fontSize: 12 }}>
                          toggle
                        </button>
                        <button onClick={() => revoke(s.user_id)} disabled={loading} style={{ fontSize: 12 }}>
                          revoke
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
