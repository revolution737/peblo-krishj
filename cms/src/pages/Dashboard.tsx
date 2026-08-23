import React, { useEffect, useState } from 'react';
import { 
  UploadCloud, 
  Eye, 
  AlertCircle, 
  Search, 
  CheckCircle2, 
  Image as ImageIcon, 
  Film, 
  Layers, 
  X,
  Clock,
  Globe,
  Edit2
} from 'lucide-react';
import api from '../api';

interface Show {
  id: string;
  title: string;
  slug: string;
  section: string | null;
  categories: string[];
  synopsis: string | null;
  status: string;
}

interface Episode {
  id: string;
  show_id: string;
  season_id: string;
  episode_number: number;
  episode_title: string;
  duration_seconds: number | null;
  language: string;
  content_group: string;
  status: string;
}

const Dashboard: React.FC = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [showEpisodes, setShowEpisodes] = useState<Episode[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // History & Rollback state
  const [publishHistory, setPublishHistory] = useState<any[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Artwork upload modal state
  const [uploadModalEpisode, setUploadModalEpisode] = useState<Episode | null>(null);
  const [artworkType, setArtworkType] = useState<'poster' | 'banner' | 'thumbnail'>('poster');
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit state
  const [editingShowId, setEditingShowId] = useState<string | null>(null);
  const [editingShowTitle, setEditingShowTitle] = useState('');
  
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [editingEpisodeTitle, setEditingEpisodeTitle] = useState('');

  const role = localStorage.getItem('userRole') || 'admin';

  const fetchShows = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/shows');
      setShows(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.error('Failed to fetch shows', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  const openShowDetails = async (show: Show) => {
    setSelectedShow(show);
    setLoadingDetails(true);
    try {
      const episodesRes = await api.get(`/admin/episodes?show_id=${show.id}`);
      setShowEpisodes(Array.isArray(episodesRes.data) ? episodesRes.data : []);
    } catch (err: any) {
      console.error('Failed to fetch show details', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to publish the catalog? This will generate the live catalogue.json file atomically.')) return;
    
    setIsPublishing(true);
    setPublishResult(null);
    try {
      const response = await api.post('/admin/catalog/publish');
      setPublishResult({ type: 'success', data: response.data });
    } catch (err: any) {
      setPublishResult({ 
        type: 'error', 
        message: err.response?.data?.detail || 'Failed to publish catalog.' 
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/admin/catalog/history');
      setPublishHistory(res.data.history);
    } catch (err: any) {
      console.error('Failed to fetch history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    if (!isHistoryExpanded) {
      fetchHistory();
    }
    setIsHistoryExpanded(!isHistoryExpanded);
  };

  const handleRollback = async (runId: string) => {
    if (!window.confirm('Are you sure you want to rollback to this version? This will immediately change the live viewer catalog.')) return;
    try {
      await api.post(`/admin/catalog/rollback/${runId}`);
      alert('Rollback successful!');
      fetchHistory(); // Refresh history
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Rollback failed.');
    }
  };

  const handleArtworkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModalEpisode || !artworkFile) return;

    setUploadLoading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('episode_id', uploadModalEpisode.id);
    formData.append('artwork_type', artworkType);
    formData.append('file', artworkFile);

    try {
      const res = await api.post('/admin/artwork/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMessage({
        type: 'success',
        text: `Uploaded ${artworkType} successfully! (${res.data.width_px}x${res.data.height_px})`
      });
      setArtworkFile(null);
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Artwork upload failed.'
      });
    } finally {
      setUploadLoading(false);
    }
  };

  const saveShowTitle = async (showId: string) => {
    if (!editingShowTitle.trim()) return;
    try {
      const show = shows.find(s => s.id === showId);
      if (!show) return;
      await api.put(`/admin/shows/${showId}`, { ...show, title: editingShowTitle });
      setShows(shows.map(s => s.id === showId ? { ...s, title: editingShowTitle } : s));
      setEditingShowId(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update show title');
    }
  };

  const saveEpisodeTitle = async (episodeId: string) => {
    if (!editingEpisodeTitle.trim()) return;
    try {
      const ep = showEpisodes.find(e => e.id === episodeId);
      if (!ep) return;
      await api.put(`/admin/episodes/${episodeId}`, { ...ep, episode_title: editingEpisodeTitle });
      setShowEpisodes(showEpisodes.map(e => e.id === episodeId ? { ...e, episode_title: editingEpisodeTitle } : e));
      setEditingEpisodeId(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update episode title');
    }
  };

  const filteredShows = shows.filter(s => 
    (s.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.section || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-gradient" style={{ marginBottom: '0.5rem' }}>Content Catalog</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Manage shows, episodes, upload artworks, and publish to the viewer.
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={toggleHistory}
            className="btn btn-secondary"
            title="View publish history & rollback"
          >
            <Clock size={18} />
            {isHistoryExpanded ? 'Close History' : 'Publish History'}
          </button>
          <button 
            onClick={handlePublish} 
            disabled={isPublishing || role !== 'admin'}
            className="btn btn-primary"
            title={role !== 'admin' ? 'Only Admins can publish' : 'Publish catalog'}
          >
            <UploadCloud size={18} />
            {isPublishing ? 'Publishing...' : 'Publish Live Catalog'}
          </button>
        </div>
      </div>

      {publishResult?.type === 'success' && (
        <div className="glass-card mb-8 animate-fade-in" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={20} color="#10b981" />
            <h3 style={{ color: '#10b981', margin: 0 }}>Publish Succeeded!</h3>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Run ID: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>{publishResult.data.run_id}</code> | Collapsed and published <strong>{publishResult.data.shows} shows</strong> with <strong>{publishResult.data.episodes} episodes</strong>.
          </p>
        </div>
      )}

      {publishResult?.type === 'error' && (
        <div className="glass-card mb-8 animate-fade-in" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} /> Publish Failed
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{publishResult.message}</p>
        </div>
      )}

      {isHistoryExpanded && (
        <div className="glass-card mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl m-0 flex items-center gap-2"><Clock size={20} /> Publish History & Rollbacks</h2>
            <button onClick={() => setIsHistoryExpanded(false)} className="btn btn-secondary p-2"><X size={16} /></button>
          </div>
          
          <div className="table-responsive">
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Run ID</th>
                  <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
                  <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Triggered By</th>
                  <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Stats</th>
                  <th className="p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={5} className="p-4 text-center"><div className="loader inline-block"></div></td></tr>
                ) : publishHistory.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-secondary">No successful publish runs found.</td></tr>
                ) : (
                  publishHistory.map((run, idx) => (
                    <tr key={run.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx === 0 ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                      <td className="p-3 text-sm font-mono">{run.id.split('-')[0]}...</td>
                      <td className="p-3 text-sm">{new Date(run.completed_at).toLocaleString()}</td>
                      <td className="p-3 text-sm">{run.triggered_by_email}</td>
                      <td className="p-3 text-sm">{run.show_count} shows, {run.episode_count} eps</td>
                      <td className="p-3">
                        <button 
                          onClick={() => handleRollback(run.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          disabled={role !== 'admin'}
                          title={role !== 'admin' ? 'Admins only' : 'Rollback catalog to this version'}
                        >
                          {idx === 0 ? 'Current Live' : 'Rollback to this'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-secondary italic">
              <AlertCircle size={12} className="inline mr-1" />
              Note: Rolling back replaces the static catalogue JSON file served to users, but does not revert the CMS database. The next manual publish will overwrite the rollback with the current database state.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-6" style={{ maxWidth: '400px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search shows or sections..." 
            style={{ paddingLeft: '2.5rem' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="loader" style={{ width: '40px', height: '40px' }} /></div>
      ) : filteredShows.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center p-8 text-center">
          <Film size={48} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
          <h3>No Shows Found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>No shows match your query or the database is empty.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredShows.map(show => {
            const isExpanded = selectedShow?.id === show.id;
            return (
              <div key={show.id} className="glass-card flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    {editingShowId === show.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input 
                          type="text" 
                          className="input-field" 
                          value={editingShowTitle} 
                          onChange={(e) => setEditingShowTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveShowTitle(show.id); if (e.key === 'Escape') setEditingShowId(null); }}
                          autoFocus
                          style={{ padding: '0.25rem 0.5rem', fontSize: '1.1rem' }}
                        />
                        <button onClick={() => saveShowTitle(show.id)} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }}>Save</button>
                        <button onClick={() => setEditingShowId(null)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>Cancel</button>
                      </div>
                    ) : (
                      <h3 style={{ margin: 0, fontSize: '1.25rem', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {show.title}
                        {role === 'admin' || role === 'editor' ? (
                          <button 
                            onClick={() => { setEditingShowId(show.id); setEditingShowTitle(show.title); }}
                            className="text-secondary hover:text-primary transition-colors"
                            title="Edit Title"
                          >
                            <Edit2 size={16} />
                          </button>
                        ) : null}
                      </h3>
                    )}
                    <div className="flex gap-2 items-center">
                      <span className={`badge ${show.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                        {show.status}
                      </span>
                    </div>
                  </div>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                    {show.synopsis || 'No synopsis provided.'}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <span className="badge badge-primary">
                      Section: {show.section || 'None'}
                    </span>
                    {(show.categories || []).map((cat, idx) => (
                      <span key={idx} className="badge badge-secondary" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={() => isExpanded ? setSelectedShow(null) : openShowDetails(show)} 
                  className="btn btn-secondary flex items-center justify-center gap-2 mt-2" 
                  style={{ width: '100%', background: isExpanded ? 'var(--surface-color-solid)' : '' }}
                >
                  <Eye size={16} /> {isExpanded ? 'Collapse' : 'Manage Episodes & Artwork'}
                </button>

                {isExpanded && (
                  <div className="mt-4 animate-fade-in" style={{ padding: '1.5rem', background: 'var(--surface-color-solid)', borderRadius: 'var(--radius-md)' }}>
                    <h3 style={{ paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
                      Seasons & Episodes
                    </h3>

                    {loadingDetails ? (
                      <div className="flex justify-center p-8"><div className="loader" /></div>
                    ) : showEpisodes.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)' }}>No episodes recorded for this show.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {showEpisodes.map(ep => (
                          <div key={ep.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                                    Ep {ep.episode_number}
                                  </span>
                                  {editingEpisodeId === ep.id ? (
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="text" 
                                        className="input-field" 
                                        value={editingEpisodeTitle} 
                                        onChange={(e) => setEditingEpisodeTitle(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveEpisodeTitle(ep.id); if (e.key === 'Escape') setEditingEpisodeId(null); }}
                                        autoFocus
                                        style={{ padding: '0.1rem 0.5rem', fontSize: '0.9rem' }}
                                      />
                                      <button onClick={() => saveEpisodeTitle(ep.id)} className="btn btn-primary" style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}>Save</button>
                                      <button onClick={() => setEditingEpisodeId(null)} className="btn btn-secondary" style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}>Cancel</button>
                                    </div>
                                  ) : (
                                    <strong style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {ep.episode_title}
                                      {role === 'admin' || role === 'editor' ? (
                                        <button 
                                          onClick={() => { setEditingEpisodeId(ep.id); setEditingEpisodeTitle(ep.episode_title); }}
                                          className="text-secondary hover:text-primary transition-colors"
                                          title="Edit Title"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                      ) : null}
                                    </strong>
                                  )}
                                  {ep.episode_number === 0 && <span className="badge badge-warning">Trailer (S0)</span>}
                                </div>
                                <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                  <span className="flex items-center gap-1"><Globe size={13} /> Lang: {ep.language}</span>
                                  <span className="flex items-center gap-1"><Layers size={13} /> Group: {ep.content_group}</span>
                                  {ep.duration_seconds && (
                                    <span className="flex items-center gap-1"><Clock size={13} /> {Math.floor(ep.duration_seconds / 60)}m {ep.duration_seconds % 60}s</span>
                                  )}
                                  <span className={`badge ${ep.status === 'published' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                                    {ep.status}
                                  </span>
                                </div>
                              </div>

                              <button 
                                onClick={() => setUploadModalEpisode(uploadModalEpisode?.id === ep.id ? null : ep)}
                                className="btn btn-secondary" 
                                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                              >
                                {uploadModalEpisode?.id === ep.id ? <><X size={15} /> Cancel</> : <><ImageIcon size={15} /> Upload Artwork</>}
                              </button>
                            </div>
                            
                            {uploadModalEpisode?.id === ep.id && (
                              <div className="animate-fade-in" style={{ 
                                marginTop: '1rem', 
                                padding: '1rem', 
                                background: '#3f3f46', 
                                borderRadius: 'var(--radius-md)' 
                              }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                  Target: <strong>{uploadModalEpisode.episode_title}</strong> (Group: {uploadModalEpisode.content_group})
                                </p>

                                {uploadMessage && (
                                  <div className="glass-card mb-4" style={{
                                    borderColor: uploadMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                                    background: uploadMessage.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                    padding: '0.75rem 1rem'
                                  }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: uploadMessage.type === 'success' ? '#6ee7b7' : '#fca5a5' }}>
                                      {uploadMessage.text}
                                    </p>
                                  </div>
                                )}

                                <form onSubmit={handleArtworkUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        Artwork Specification
                                      </label>
                                      <select 
                                        className="input-field" 
                                        value={artworkType} 
                                        onChange={e => setArtworkType(e.target.value as any)}
                                      >
                                        <option value="poster">Poster (2:3 Aspect Ratio)</option>
                                        <option value="banner">Banner (16:9 Aspect Ratio)</option>
                                        <option value="thumbnail">Thumbnail (16:9 Aspect Ratio)</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        Select Image (JPEG or PNG)
                                      </label>
                                      <input 
                                        type="file" 
                                        accept="image/jpeg,image/png"
                                        className="input-field" 
                                        onChange={e => setArtworkFile(e.target.files?.[0] || null)}
                                        required
                                      />
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <button 
                                      type="submit" 
                                      disabled={uploadLoading || !artworkFile}
                                      className="btn btn-primary"
                                    >
                                      {uploadLoading ? 'Uploading...' : 'Validate & Upload'}
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>

  );
};

export default Dashboard;
