import React, { useEffect, useState, useRef } from 'react';
import { 
  UploadCloud, Eye, Search, 
  Image as ImageIcon, Film, Layers, X, Clock, Globe, Edit2, 
  Plus, ChevronLeft, ChevronRight, Upload, Trash2
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

interface Artwork {
  id: string;
  artwork_type: string;
  storage_path: string;
  width_px: number;
  height_px: number;
}

const Dashboard: React.FC = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [search, setSearch] = useState('');
  
  // Filters & Pagination
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [showEpisodes, setShowEpisodes] = useState<Episode[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // History & Rollback state
  const [publishHistory, setPublishHistory] = useState<any[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Creation Modals
  const [isCreateShowOpen, setIsCreateShowOpen] = useState(false);
  const [newShow, setNewShow] = useState({ title: '', slug: '', section: '', synopsis: '', status: 'draft', categories: '' });
  
  const [isCreateEpisodeOpen, setIsCreateEpisodeOpen] = useState(false);
  const [newEpisode, setNewEpisode] = useState({ episode_number: 1, episode_title: '', language: 'en', content_group: '', duration_seconds: '', status: 'draft' });

  // 3-Slot Artwork upload modal state
  const [uploadModalEpisode, setUploadModalEpisode] = useState<Episode | null>(null);
  const [episodeArtworks, setEpisodeArtworks] = useState<Artwork[]>([]);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit state
  const [editingShowId, setEditingShowId] = useState<string | null>(null);
  const [editingShow, setEditingShow] = useState<any>({});
  
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [editingEpisode, setEditingEpisode] = useState<any>({});

  const role = localStorage.getItem('userRole') || 'admin';

  const fetchShows = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('skip', (page * limit).toString());
      params.append('limit', limit.toString());
      if (filterSection) params.append('section', filterSection);
      if (filterStatus) params.append('status', filterStatus);

      const response = await api.get(`/admin/shows?${params.toString()}`);
      let fetchedShows = Array.isArray(response.data) ? response.data : [];
      if (search) {
          fetchedShows = fetchedShows.filter(s => (s.title || '').toLowerCase().includes(search.toLowerCase()));
      }
      setShows(fetchedShows);
    } catch (err: any) {
      console.error('Failed to fetch shows', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, [page, filterSection, filterStatus, search]);

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

  const fetchEpisodeArtwork = async (episodeId: string) => {
    try {
      const res = await api.get(`/admin/artwork/episode/${episodeId}`);
      setEpisodeArtworks(res.data);
    } catch(err) {
      console.error("Failed to fetch episode artwork");
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to publish the catalog?')) return;
    setIsPublishing(true);
    try {
      await api.post('/admin/catalog/publish');
      alert('Published successfully!');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to publish catalog.');
    } finally {
      setIsPublishing(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/admin/catalog/history');
      setPublishHistory(res.data.history);
    } catch (err: any) {
      console.error('Failed to fetch history', err);
    }
  };

  const toggleHistory = () => {
    if (!isHistoryExpanded) fetchHistory();
    setIsHistoryExpanded(!isHistoryExpanded);
  };

  const handleRollback = async (runId: string) => {
    if (!window.confirm('Are you sure you want to rollback to this version?')) return;
    try {
      await api.post(`/admin/catalog/rollback/${runId}`);
      alert('Rollback successful!');
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Rollback failed.');
    }
  };

  const handleCreateShow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newShow, categories: newShow.categories.split(',').map(c => c.trim()).filter(Boolean) };
      if (!payload.section) payload.section = null as any;
      await api.post('/admin/shows/', payload);
      setIsCreateShowOpen(false);
      setNewShow({ title: '', slug: '', section: '', synopsis: '', status: 'draft', categories: '' });
      fetchShows();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create show');
    }
  };

  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedShow) return;
      // Fetch seasons or create a default one
      let seasonId;
      try {
          const seasonsRes = await api.get(`/admin/seasons?show_id=${selectedShow.id}`);
          if (seasonsRes.data.length > 0) {
              seasonId = seasonsRes.data[0].id;
          } else {
              const newSeason = await api.post(`/admin/seasons`, { show_id: selectedShow.id, season_number: 1 });
              seasonId = newSeason.data.id;
          }
      } catch (e) {
          alert('Failed to get/create season'); return;
      }

      const payload = { 
          ...newEpisode, 
          show_id: selectedShow.id, 
          season_id: seasonId,
          duration_seconds: newEpisode.duration_seconds ? parseInt(newEpisode.duration_seconds) : null
      };
      await api.post('/admin/episodes/', payload);
      setIsCreateEpisodeOpen(false);
      setNewEpisode({ episode_number: 1, episode_title: '', language: 'en', content_group: '', duration_seconds: '', status: 'draft' });
      openShowDetails(selectedShow);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create episode');
    }
  };

  const handleUpdateShow = async (showId: string) => {
    try {
      const show = shows.find(s => s.id === showId);
      if (!show) return;
      const payload = { ...show, ...editingShow };
      if (!payload.section) payload.section = null;
      await api.put(`/admin/shows/${showId}`, payload);
      setEditingShowId(null);
      fetchShows();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update show');
    }
  };

  const handleUpdateEpisode = async (episodeId: string) => {
    try {
      const ep = showEpisodes.find(e => e.id === episodeId);
      if (!ep) return;
      const payload = { ...ep, ...editingEpisode };
      if (payload.duration_seconds && typeof payload.duration_seconds === 'string') {
          payload.duration_seconds = parseInt(payload.duration_seconds);
      } else if (!payload.duration_seconds) {
          payload.duration_seconds = null;
      }
      await api.put(`/admin/episodes/${episodeId}`, payload);
      setEditingEpisodeId(null);
      if (selectedShow) openShowDetails(selectedShow);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update episode');
    }
  };

  const uploadArtwork = async (type: string, file: File) => {
      if (!uploadModalEpisode) return;
      const formData = new FormData();
      formData.append('episode_id', uploadModalEpisode.id);
      formData.append('artwork_type', type);
      formData.append('file', file);
      
      setUploadMessage(null);
      try {
        await api.post('/admin/artwork/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        setUploadMessage({ type: 'success', text: `Uploaded ${type} successfully!`});
        await fetchEpisodeArtwork(uploadModalEpisode.id);
      } catch (err: any) {
        setUploadMessage({ type: 'error', text: err.response?.data?.detail || 'Upload failed.' });
        throw err;
      }
  };

  const deleteArtwork = async (artworkId: string) => {
      if (!window.confirm('Are you sure you want to delete this artwork?')) return;
      try {
          await api.delete(`/admin/artwork/${artworkId}`);
          setUploadMessage({ type: 'success', text: 'Artwork deleted successfully!'});
          if (uploadModalEpisode) fetchEpisodeArtwork(uploadModalEpisode.id);
      } catch (err: any) {
          setUploadMessage({ type: 'error', text: err.response?.data?.detail || 'Delete failed.' });
      }
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-gradient" style={{ marginBottom: '0.5rem' }}>Content Catalog</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage shows, episodes, upload artworks, and publish to the viewer.</p>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setIsCreateShowOpen(true)} className="btn btn-secondary"><Plus size={18} /> New Show</button>
          <button onClick={toggleHistory} className="btn btn-secondary"><Clock size={18} /> {isHistoryExpanded ? 'Close History' : 'Publish History'}</button>
          <button onClick={handlePublish} disabled={isPublishing || role !== 'admin'} className="btn btn-primary">
            <UploadCloud size={18} /> {isPublishing ? 'Publishing...' : 'Publish Live Catalog'}
          </button>
        </div>
      </div>

      {/* History & Rollback */}
      {isHistoryExpanded && (
        <div className="glass-card mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl m-0 flex items-center gap-2"><Clock size={20} /> Publish History</h2>
            <button onClick={() => setIsHistoryExpanded(false)} className="btn btn-secondary p-2"><X size={16} /></button>
          </div>
          <div className="table-responsive">
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th className="p-3 text-sm">Run ID</th>
                  <th className="p-3 text-sm">Date</th>
                  <th className="p-3 text-sm">Status</th>
                  <th className="p-3 text-sm">Stats</th>
                  <th className="p-3 text-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {publishHistory.map((run, idx) => (
                  <tr key={run.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx === 0 ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                    <td className="p-3 text-sm font-mono">{run.id.split('-')[0]}...</td>
                    <td className="p-3 text-sm">{new Date(run.completed_at).toLocaleString()}</td>
                    <td className="p-3 text-sm">{run.status}</td>
                    <td className="p-3 text-sm">{run.show_count} shows, {run.episode_count} eps</td>
                    <td className="p-3">
                      <button onClick={() => handleRollback(run.id)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={role !== 'admin' || idx === 0}>
                        {idx === 0 ? 'Current Live' : 'Rollback'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input type="text" className="input-field" placeholder="Search shows..." style={{ paddingLeft: '2.5rem' }} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field" style={{ width: 'auto' }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
          <option value="">All Sections</option>
          <option value="featured">Featured</option>
          <option value="series">Series</option>
          <option value="minisodes">Minisodes</option>
          <option value="songs">Songs</option>
        </select>
        <select className="input-field" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Show List */}
      {isLoading ? (
        <div className="flex justify-center p-8"><div className="loader" style={{ width: '40px', height: '40px' }} /></div>
      ) : shows.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center p-8 text-center">
          <Film size={48} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
          <h3>No Shows Found</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {shows.map(show => {
            const isExpanded = selectedShow?.id === show.id;
            return (
              <div key={show.id} className="glass-card flex flex-col justify-between">
                <div className="flex justify-between items-start gap-4 mb-3">
                    {editingShowId === show.id ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <input type="text" className="input-field" value={editingShow.title} onChange={e => setEditingShow({...editingShow, title: e.target.value})} placeholder="Title" />
                        <select className="input-field" value={editingShow.section || ''} onChange={e => setEditingShow({...editingShow, section: e.target.value})}>
                            <option value="">No Section</option>
                            <option value="featured">Featured</option>
                            <option value="series">Series</option>
                            <option value="minisodes">Minisodes</option>
                            <option value="songs">Songs</option>
                        </select>
                        <select className="input-field" value={editingShow.status} onChange={e => setEditingShow({...editingShow, status: e.target.value})}>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                        </select>
                        <button onClick={() => handleUpdateShow(show.id)} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Save</button>
                        <button onClick={() => setEditingShowId(null)} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex-1">
                          <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {show.title}
                            <button onClick={() => { setEditingShowId(show.id); setEditingShow(show); }} className="text-secondary hover:text-primary"><Edit2 size={16} /></button>
                          </h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{show.synopsis || 'No synopsis'}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <span className="badge badge-primary">Section: {show.section || 'None'}</span>
                            <span className={`badge ${show.status === 'published' ? 'badge-success' : 'badge-warning'}`}>{show.status}</span>
                          </div>
                      </div>
                    )}
                </div>
                
                <button onClick={() => isExpanded ? setSelectedShow(null) : openShowDetails(show)} className="btn btn-secondary flex items-center justify-center gap-2 mt-2 w-full">
                  <Eye size={16} /> {isExpanded ? 'Collapse' : 'Manage Episodes & Artwork'}
                </button>

                {isExpanded && (
                  <div className="mt-4 animate-fade-in" style={{ padding: '1.5rem', background: 'var(--surface-color-solid)', borderRadius: 'var(--radius-md)' }}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="m-0">Seasons & Episodes</h3>
                        <button onClick={() => setIsCreateEpisodeOpen(true)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Plus size={16}/> New Episode</button>
                    </div>

                    {loadingDetails ? <div className="flex justify-center p-4"><div className="loader" /></div> : showEpisodes.length === 0 ? <p className="text-secondary">No episodes.</p> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {showEpisodes.map(ep => (
                          <div key={ep.id} className="glass-panel flex flex-col gap-4" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                            <div className="flex justify-between items-center">
                              {editingEpisodeId === ep.id ? (
                                <div className="flex flex-wrap items-center gap-2 flex-1">
                                    <input type="text" className="input-field" value={editingEpisode.episode_title} onChange={e => setEditingEpisode({...editingEpisode, episode_title: e.target.value})} placeholder="Title" />
                                    <input type="number" className="input-field" style={{width: '100px'}} value={editingEpisode.duration_seconds || ''} onChange={e => setEditingEpisode({...editingEpisode, duration_seconds: e.target.value})} placeholder="Duration (s)" />
                                    <select className="input-field" value={editingEpisode.status} onChange={e => setEditingEpisode({...editingEpisode, status: e.target.value})}>
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                    </select>
                                    <button onClick={() => handleUpdateEpisode(ep.id)} className="btn btn-primary px-3 py-2 text-sm">Save</button>
                                    <button onClick={() => setEditingEpisodeId(null)} className="btn btn-secondary px-3 py-2 text-sm">Cancel</button>
                                </div>
                              ) : (
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                    <span className="badge badge-primary">Ep {ep.episode_number}</span>
                                    {ep.episode_number === 0 && <span className="badge badge-warning">Trailer (S0)</span>}
                                    <strong className="flex items-center gap-2" style={{ fontSize: '1.1rem' }}>{ep.episode_title} <button onClick={() => { setEditingEpisodeId(ep.id); setEditingEpisode(ep); }} className="text-secondary hover:text-primary"><Edit2 size={14} /></button></strong>
                                    </div>
                                    <div className="flex gap-4 text-sm text-secondary">
                                        <span><Globe size={13} className="inline mr-1"/> {ep.language}</span>
                                        <span><Layers size={13} className="inline mr-1"/> {ep.content_group}</span>
                                        <span><Clock size={13} className="inline mr-1"/> {ep.duration_seconds ? `${Math.floor(ep.duration_seconds/60)}m ${ep.duration_seconds%60}s` : 'No duration'}</span>
                                        <span className={`badge ${ep.status === 'published' ? 'badge-success' : 'badge-warning'} text-[0.65rem] px-1 py-0`}>{ep.status}</span>
                                    </div>
                                </div>
                              )}
                              <button onClick={() => {
                                  if (uploadModalEpisode?.id === ep.id) { setUploadModalEpisode(null); } 
                                  else { setUploadModalEpisode(ep); fetchEpisodeArtwork(ep.id); setUploadMessage(null); }
                              }} className="btn btn-secondary px-4 py-2 text-sm">
                                {uploadModalEpisode?.id === ep.id ? 'Close Artwork' : 'Manage Artwork'}
                              </button>
                            </div>
                            
                            {/* 3-Slot Artwork UI */}
                            {uploadModalEpisode?.id === ep.id && (
                              <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                                <h4 className="mb-4" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-color)' }}>Artwork for: {ep.episode_title}</h4>
                                {uploadMessage && (
                                    <div style={{
                                        padding: '0.75rem', 
                                        borderRadius: '0.5rem', 
                                        marginBottom: '1rem',
                                        backgroundColor: uploadMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                        color: uploadMessage.type === 'success' ? '#6ee7b7' : '#fca5a5'
                                    }}>
                                        {uploadMessage.text}
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                    <ArtworkSlot 
                                        type="poster" 
                                        label="Poster (2:3)" 
                                        dimensions="~600x900px" 
                                        artwork={episodeArtworks.find(a => a.artwork_type === 'poster')} 
                                        onUpload={(file) => uploadArtwork('poster', file)} 
                                        onDelete={() => {
                                            const art = episodeArtworks.find(a => a.artwork_type === 'poster');
                                            if (art) deleteArtwork(art.id);
                                        }}
                                    />
                                    <ArtworkSlot 
                                        type="banner" 
                                        label="Banner (16:9)" 
                                        dimensions="~1280x720px" 
                                        artwork={episodeArtworks.find(a => a.artwork_type === 'banner')} 
                                        onUpload={(file) => uploadArtwork('banner', file)} 
                                        onDelete={() => {
                                            const art = episodeArtworks.find(a => a.artwork_type === 'banner');
                                            if (art) deleteArtwork(art.id);
                                        }}
                                    />
                                    <ArtworkSlot 
                                        type="thumbnail" 
                                        label="Thumbnail (16:9)" 
                                        dimensions="~640x360px" 
                                        artwork={episodeArtworks.find(a => a.artwork_type === 'thumbnail')} 
                                        onUpload={(file) => uploadArtwork('thumbnail', file)} 
                                        onDelete={() => {
                                            const art = episodeArtworks.find(a => a.artwork_type === 'thumbnail');
                                            if (art) deleteArtwork(art.id);
                                        }}
                                    />
                                </div>
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

      {/* Pagination Controls */}
      <div className="flex justify-center items-center gap-4 mt-8">
          <button className="btn btn-secondary" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}><ChevronLeft size={16}/> Prev</button>
          <span>Page {page + 1}</span>
          <button className="btn btn-secondary" onClick={() => setPage(page + 1)} disabled={shows.length < limit}>Next <ChevronRight size={16}/></button>
      </div>

      {/* Create Show Modal */}
      {isCreateShowOpen && (
          <div className="modal-overlay" onClick={() => setIsCreateShowOpen(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setIsCreateShowOpen(false)}><X size={20} /></button>
                  <h2 style={{marginTop: 0}}>Create New Show</h2>
                  <form onSubmit={handleCreateShow} className="flex flex-col gap-4 mt-4">
                      <input className="input-field" placeholder="Title" required value={newShow.title} onChange={e => setNewShow({...newShow, title: e.target.value})} />
                      <input className="input-field" placeholder="Slug (e.g. my-show)" required value={newShow.slug} onChange={e => setNewShow({...newShow, slug: e.target.value})} />
                      <select className="input-field" value={newShow.section} onChange={e => setNewShow({...newShow, section: e.target.value})}>
                          <option value="">No Section</option>
                          <option value="featured">Featured</option>
                          <option value="series">Series</option>
                          <option value="minisodes">Minisodes</option>
                          <option value="songs">Songs</option>
                      </select>
                      <textarea className="input-field" placeholder="Synopsis" value={newShow.synopsis} onChange={e => setNewShow({...newShow, synopsis: e.target.value})} />
                      <input className="input-field" placeholder="Categories (comma separated)" value={newShow.categories} onChange={e => setNewShow({...newShow, categories: e.target.value})} />
                      <select className="input-field" value={newShow.status} onChange={e => setNewShow({...newShow, status: e.target.value})}>
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                      </select>
                      <button type="submit" className="btn btn-primary mt-2">Create Show</button>
                  </form>
              </div>
          </div>
      )}

      {/* Create Episode Modal */}
      {isCreateEpisodeOpen && selectedShow && (
          <div className="modal-overlay" onClick={() => setIsCreateEpisodeOpen(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setIsCreateEpisodeOpen(false)}><X size={20} /></button>
                  <h2 style={{marginTop: 0}}>Add Episode to {selectedShow.title}</h2>
                  <form onSubmit={handleCreateEpisode} className="flex flex-col gap-4 mt-4">
                      <input className="input-field" type="number" placeholder="Episode Number" required value={newEpisode.episode_number} onChange={e => setNewEpisode({...newEpisode, episode_number: parseInt(e.target.value)})} />
                      <input className="input-field" placeholder="Episode Title" required value={newEpisode.episode_title} onChange={e => setNewEpisode({...newEpisode, episode_title: e.target.value})} />
                      <input className="input-field" placeholder="Content Group (e.g. show-s01e01)" required value={newEpisode.content_group} onChange={e => setNewEpisode({...newEpisode, content_group: e.target.value})} />
                      <select className="input-field" value={newEpisode.language} onChange={e => setNewEpisode({...newEpisode, language: e.target.value})}>
                          <option value="en">English</option>
                          <option value="hi">Hindi</option>
                      </select>
                      <input className="input-field" type="number" placeholder="Duration (seconds)" value={newEpisode.duration_seconds} onChange={e => setNewEpisode({...newEpisode, duration_seconds: e.target.value})} />
                      <select className="input-field" value={newEpisode.status} onChange={e => setNewEpisode({...newEpisode, status: e.target.value})}>
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                      </select>
                      <button type="submit" className="btn btn-primary mt-2">Create Episode</button>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};

// 3-Slot Artwork Component
const ArtworkSlot: React.FC<{type: string, label: string, dimensions: string, artwork?: Artwork, onUpload: (f: File) => Promise<void>, onDelete?: () => void}> = ({type, label, dimensions, artwork, onUpload, onDelete}) => {
    const [preview, setPreview] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreview(URL.createObjectURL(file));
            try {
                await onUpload(file);
            } catch (err) {
                setPreview(null); // Clear preview on upload failure
            }
        }
    };

    return (
        <div style={{ background: '#27272a', padding: '1rem', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', border: '1px solid #52525b' }}>
            {artwork && onDelete && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); setPreview(null); }} 
                    style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(239, 68, 68, 0.9)', padding: '0.25rem', borderRadius: '4px', zIndex: 10, border: 'none', cursor: 'pointer' }}
                    title="Delete Artwork"
                >
                    <Trash2 size={14} color="white" />
                </button>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h5 style={{ margin: 0, color: 'white', fontWeight: 500 }}>{label}</h5>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{dimensions}</span>
                </div>
            </div>
            
            <div style={{ 
                aspectRatio: type === 'poster' ? '2/3' : '16/9', 
                background: '#18181b', 
                borderRadius: '0.25rem', 
                overflow: 'hidden', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                position: 'relative',
                marginTop: '0.5rem',
                cursor: 'pointer'
            }} onClick={() => fileRef.current?.click()}>
                {preview ? (
                    <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                ) : artwork ? (
                    <img src={`http://localhost:8000/storage/${artwork.storage_path}`} alt="current" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                ) : (
                    <ImageIcon size={24} color="#4b5563" />
                )}
                
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', opacity: 0, background: 'rgba(0,0,0,0.4)', transition: 'opacity 0.2s' }} 
                     onMouseEnter={e => (e.currentTarget.style.opacity = '1')} 
                     onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                    <Upload size={20} style={{ marginBottom: '4px' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Upload new</span>
                </div>
            </div>
            <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/jpeg,image/png" onChange={handleFile} />
        </div>
    );
};

export default Dashboard;
