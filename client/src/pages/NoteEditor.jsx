// client/src/pages/NoteEditor.jsx
import React, { useEffect, useState } from 'react';
import API from '../api';
import ShareModal from '../components/ShareModal';
import VersionsModal from '../components/VersionsModal';
import Tasks from './Tasks';

export default function NoteEditor({ note: selectedNote, onSaved }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [note, setNote] = useState(null); // note object as returned by server (may include permission)
  const [permission, setPermission] = useState({ is_owner: false, can_edit: false });
  const [showShare, setShowShare] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync incoming selectedNote: If selectedNote comes from parent as simple note (old shape),
  // try to fetch fresh server copy to get permission flags.
  useEffect(() => {
    let mounted = true;

    async function fetchFresh(noteObj) {
      try {
        if (!noteObj || !noteObj.id) {
          // No saved note selected — clear editor
          if (!mounted) return;
          setNote(null);
          setPermission({ is_owner: false, can_edit: false });
          setTitle('');
          setContent('');
          return;
        }
        // fetch server version (returns permission)
        const { data } = await API.get(`/notes/${noteObj.id}`);
        if (!mounted) return;
        // server returns note with a nested permission object
        const { permission, ...noteFields } = data;
        setNote(noteFields);
        setPermission(permission || { is_owner: false, can_edit: false });
        setTitle(noteFields.title || '');
        setContent(noteFields.content || '');
      } catch (err) {
        console.error('Failed to load note with permissions', err);
        // fallback: load passed object but mark as no-edit (safe)
        if (!mounted) return;
        setNote(noteObj || null);
        setPermission({ is_owner: false, can_edit: false });
        setTitle(noteObj?.title || '');
        setContent(noteObj?.content || '');
      }
    }

    try {
      if (selectedNote && selectedNote.id) {
        // fetch server-backed note to get permission info
        fetchFresh(selectedNote);
      } else {
        // no selection - clear
        setNote(null);
        setPermission({ is_owner: false, can_edit: false });
        setTitle('');
        setContent('');
      }
    } catch (err) {
      console.error('NoteEditor sync failed', err);
    }

    return () => { mounted = false; };
  }, [selectedNote]);

  // helper to compute whether the UI should allow editing
  const isEditable = !!(note && (permission.is_owner || permission.can_edit));
  const isOwner = !!(note && permission.is_owner);

  async function save() {
    setLoading(true);
    try {
      // If note exists (we're editing), enforce client-side check to avoid accidental request
      if (note && note.id) {
        if (!isEditable) {
          alert('You have view-only access for this note. Editing is not allowed.');
          return;
        }
        // update
        const { data } = await API.put(`/notes/${note.id}`, { title, content });
        const { permission: permFromServer, ...noteFields } = data;
        // server's PUT returns updated note; permission unchanged server-side, but keep local
        setNote(noteFields);
        alert('Saved changes');
        try { onSaved && onSaved(); } catch (cbErr) { console.error('onSaved callback threw', cbErr); }
      } else {
        // create a new note (owner is current user)
        const { data } = await API.post('/notes', { title, content });
        // server returns created note (without permission object) — owner is you
        setNote(data);
        setPermission({ is_owner: true, can_edit: true });
        setTitle('');
        setContent('');
        alert('Note created');
        try { onSaved && onSaved(); } catch (cbErr) { console.error('onSaved callback threw', cbErr); }
      }
    } catch (e) {
      console.error('Save failed', e);
      const msg = e?.response?.data?.error || e?.response?.data?.details || e?.message || 'Save failed';
      alert('Save failed: ' + msg);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!note || !note.id) return alert('No saved note selected to delete');
    if (!isOwner) return alert('Only the owner can delete this note.');
    if (!confirm('Delete this note permanently?')) return;
    try {
      await API.delete(`/notes/${note.id}`);
      alert('Deleted');
      setNote(null);
      setPermission({ is_owner: false, can_edit: false });
      setTitle('');
      setContent('');
      try { onSaved && onSaved(); } catch (cbErr) { console.error('onSaved callback threw', cbErr); }
    } catch (e) {
      console.error('Delete failed', e);
      alert('Delete failed: ' + (e?.response?.data?.error || e?.message || 'Delete failed'));
    }
  }

  // UI rendering — show clear read-only banner and disable editing controls
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{note ? 'Edit Note' : 'New Note'}</h3>
        {note && <div style={{ fontSize: 13, color: '#6b7280' }}>ID: {note.id}</div>}
      </div>

      {/* Read-only banner */}
      {note && !isEditable && (
        <div style={{ padding: 10, background: '#fff4e6', border: '1px solid #ffd8a8', borderRadius: 8, marginBottom: 10 }}>
          <strong>Read only:</strong> You have view-only access to this note. Editing is disabled.
        </div>
      )}

      <input
        className="input"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={!isEditable && !!note} // disabled when viewing an existing note and not editable
      />
      <textarea
        className="input"
        placeholder="Write your note..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        disabled={!isEditable && !!note}
      />

      <div className="controls">
        <button className="button" onClick={save} disabled={loading || (!!note && !isEditable)}>
          {note ? 'Save changes' : 'Create note'}
        </button>

        {note && (
          <>
            <button
              className="button secondary small"
              onClick={() => setShowShare(true)}
              disabled={!isOwner} // only owner can open share management
            >
              Share
            </button>
            <button
              className="button secondary small"
              onClick={() => setShowVersions(true)}
              disabled={!isEditable} // view versions if at least read permitted; revert requires edit permission internally
            >
              Versions
            </button>
            <button
              className="button secondary small"
              onClick={remove}
              disabled={!isOwner}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {/* Only show tasks/other per-note UI when there is a saved note with an id.
          Tasks: you may want tasks editable only if can_edit; adjust Tasks component if necessary. */}
      {note && note.id && (
        <div style={{ marginTop: 14 }}>
          <Tasks noteId={note.id} />
        </div>
      )}

      {showShare && note && note.id && (
        <div style={{ marginTop: 12 }}>
          <ShareModal
            noteId={note.id}
            onClose={() => setShowShare(false)}
            onShared={() => {
              try { onSaved && onSaved(); } catch (cbErr) { console.error('onSaved threw', cbErr); }
            }}
          />
        </div>
      )}

      {showVersions && note && note.id && (
        <div style={{ marginTop: 12 }}>
          <VersionsModal
            noteId={note.id}
            onClose={() => setShowVersions(false)}
            onReverted={() => {
              try { onSaved && onSaved(); } catch (cbErr) { console.error('onSaved threw', cbErr); }
              setShowVersions(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
