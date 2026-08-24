import React, { useState } from 'react';
import { 
  UploadCloud, Eye, Search, 
  Image as ImageIcon, Film, Layers, X, Clock, Globe, Edit2, 
  Plus, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import { ArtworkSlot } from '../components/ArtworkSlot';
import { CreateShowModal } from '../components/CreateShowModal';
import { CreateEpisodeModal } from '../components/CreateEpisodeModal';


// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
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


// ─────────────────────────────────────────────────────────────
// Data fetcher
// ─────────────────────────────────────────────────────────────
const fetchShowsData = async ({ queryKey }: any) => {
  const [_key, { page, limit, filterSection, filterStatus, search }] = queryKey;
  const params = new URLSearchParams();
  params.append('skip', (page * limit).toString());
  params.append('limit', limit.toString());
  if (filterSection) params.append('section', filterSection);
  if (filterStatus) params.append('status', filterStatus);

  const response = await api.get(`/admin/shows?${params.toString()}`);
  let fetchedShows = Array.isArray(response.data) ? response.data : [];

  if (search) {
    fetchedShows = fetchedShows.filter((s: any) =>
      (s.title || '').toLowerCase().includes(search.toLowerCase())
    );
  }
  return fetchedShows;
};

// ─────────────────────────────────────────────────────────────
// Dashboard component
// ─────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();

  // Toasts
  const { toasts, addToast, dismissToast } = useToast();

  const [search, setSearch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [showEpisodes, setShowEpisodes] = useState<Episode[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // History & Rollback
  const [publishHistory, setPublishHistory] = useState<any[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Modals
  const [isCreateShowOpen, setIsCreateShowOpen] = useState(false);
  const [newShow, setNewShow] = useState({ title: '', slug: '', section: '', synopsis: '', status: 'draft', categories: '' });
  const [isCreateEpisodeOpen, setIsCreateEpisodeOpen] = useState(false);
  const [newEpisode, setNewEpisode] = useState({ episode_number: 1, episode_title: '', language: 'en', content_group: '', duration_seconds: '', status: 'draft' });

  // Episode artwork
  const [uploadModalEpisode, setUploadModalEpisode] = useState<Episode | null>(null);
  const [episodeArtworks, setEpisodeArtworks] = useState<Artwork[]>([]);

  // Show artwork
  const [showArtworkModalId, setShowArtworkModalId] = useState<string | null>(null);
  const [showArtworks, setShowArtworks] = useState<Artwork[]>([]);

  // Inline editing
  const [editingShowId, setEditingShowId] = useState<string | null>(null);
  const [editingShow, setEditingShow] = useState<any>({});
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [editingEpisode, setEditingEpisode] = useState<any>({});

  const role = localStorage.getItem('userRole') || 'admin';

  const { data: shows = [], isLoading, refetch: fetchShows } = useQuery({
    queryKey: ['shows', { page, limit, filterSection, filterStatus, filterLanguage, search }],
    queryFn: fetchShowsData,
  });

  const { data: validationReport } = useQuery({
    queryKey: ['validationReportData'],
    queryFn: async () => {
      const res = await api.get('/admin/validation-report');
      return res.data;
    },
  });
  const hasBlockingIssues = validationReport?.summary?.total_blocking_issues > 0;

  // ── Show detail ──────────────────────────────────────────────
  const openShowDetails = async (show: Show) => {
    setSelectedShow(show);
    setLoadingDetails(true);
    try {
      const episodesRes = await api.get(`/admin/episodes?show_id=${show.id}`);
      let episodes = Array.isArray(episodesRes.data) ? episodesRes.data : [];
      if (filterLanguage) {
        episodes = episodes.filter((ep: Episode) => ep.language === filterLanguage);
      }
      
      episodes.sort((a: Episode, b: Episode) => {
        if (a.content_group < b.content_group) return -1;
        if (a.content_group > b.content_group) return 1;
        return 0;
      });

      setShowEpisodes(episodes);
    } catch {
      addToast('error', 'Failed to load episode details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchEpisodeArtwork = async (episodeId: string) => {
    try {
      const res = await api.get(`/admin/artwork/episode/${episodeId}`);
      setEpisodeArtworks(res.data);
    } catch {
      addToast('error', 'Failed to fetch episode artwork.');
    }
  };

  const fetchShowArtwork = async (showId: string) => {
    try {
      const res = await api.get(`/admin/artwork/show/${showId}`);
      setShowArtworks(res.data);
    } catch {
      // show artwork endpoint may not exist yet — fail silently
      setShowArtworks([]);
    }
  };

  // ── Publish ──────────────────────────────────────────────────
  const publishMutation = useMutation({
    mutationFn: async () => { await api.post('/admin/catalog/publish'); },
    onSuccess: () => {
      addToast('success', 'Catalogue published successfully!');
      queryClient.invalidateQueries({ queryKey: ['publishHistory'] });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'object'
        ? `${detail.message} (${detail.issues?.length ?? 0} issues)`
        : detail || 'Failed to publish catalogue.';
      addToast('error', msg);
    }
  });

  const handlePublish = () => {
    if (!window.confirm('Publish the catalogue now? This makes changes live for viewers.')) return;
    publishMutation.mutate();
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/admin/catalog/history');
      setPublishHistory(res.data.history);
    } catch {
      addToast('error', 'Failed to fetch publish history.');
    }
  };

  const toggleHistory = () => {
    if (!isHistoryExpanded) fetchHistory();
    setIsHistoryExpanded(!isHistoryExpanded);
  };

  const handleRollback = async (runId: string) => {
    if (!window.confirm('Roll back to this catalogue version?')) return;
    try {
      await api.post(`/admin/catalog/rollback/${runId}`);
      addToast('success', 'Rollback successful!');
      fetchHistory();
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || 'Rollback failed.');
    }
  };

  // ── Show CRUD ────────────────────────────────────────────────
  const handleCreateShow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newShow, categories: newShow.categories.split(',').map(c => c.trim()).filter(Boolean) };
      if (!payload.section) (payload as any).section = null;
      await api.post('/admin/shows/', payload);
      setIsCreateShowOpen(false);
      setNewShow({ title: '', slug: '', section: '', synopsis: '', status: 'draft', categories: '' });
      fetchShows();
      addToast('success', `Show "${newShow.title}" created.`);
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || 'Failed to create show.');
    }
  };

  const handleUpdateShow = async (showId: string) => {
    try {
      const show = shows.find((s: Show) => s.id === showId);
      if (!show) return;
      const payload = { ...show, ...editingShow };
      if (!payload.section) payload.section = null;
      await api.put(`/admin/shows/${showId}`, payload);
      setEditingShowId(null);
      fetchShows();
      addToast('success', 'Show updated.');
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || 'Failed to update show.');
    }
  };

  // ── Episode CRUD ─────────────────────────────────────────────
  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShow) return;
    try {
      // Use the flat /admin/seasons endpoint
      let seasonId: string;
      const seasonsRes = await api.get(`/admin/seasons?show_id=${selectedShow.id}`);
      if (seasonsRes.data.length > 0) {
        seasonId = seasonsRes.data[0].id;
      } else {
        const newSeason = await api.post('/admin/seasons', { show_id: selectedShow.id, season_number: 1 });
        seasonId = newSeason.data.id;
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
      addToast('success', `Episode "${payload.episode_title}" created.`);
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || 'Failed to create episode.');
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
      addToast('success', 'Episode updated.');
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || 'Failed to update episode.');
    }
  };

  // ── Artwork ──────────────────────────────────────────────────
  const uploadEpisodeArtwork = async (type: string, file: File) => {
    if (!uploadModalEpisode) return;
    const formData = new FormData();
    formData.append('episode_id', uploadModalEpisode.id);
    formData.append('artwork_type', type);
    formData.append('file', file);
    await api.post('/admin/artwork/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    await fetchEpisodeArtwork(uploadModalEpisode.id);
    addToast('success', `${type} uploaded successfully.`);
  };

  const uploadShowArtwork = async (type: string, file: File) => {
    if (!showArtworkModalId) return;
    const formData = new FormData();
    formData.append('show_id', showArtworkModalId);
    formData.append('artwork_type', type);
    formData.append('file', file);
    await api.post('/admin/artwork/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    await fetchShowArtwork(showArtworkModalId);
    addToast('success', `Show ${type} uploaded successfully.`);
  };

  const deleteArtwork = async (artworkId: string, fetchFn: () => void) => {
    if (!window.confirm('Delete this artwork?')) return;
    try {
      await api.delete(`/admin/artwork/${artworkId}`);
      fetchFn();
      addToast('success', 'Artwork deleted.');
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || 'Delete failed.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in pb-20">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-gradient" style={{ marginBottom: '0.5rem' }}>Content Catalog</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage shows, episodes, upload artworks, and publish to the viewer.</p>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setIsCreateShowOpen(true)} className="btn btn-secondary"><Plus size={18} /> New Show</button>
          <button onClick={toggleHistory} className="btn btn-secondary"><Clock size={18} /> {isHistoryExpanded ? 'Close History' : 'Publish History'}</button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={handlePublish}
              disabled={publishMutation.isPending || role !== 'admin' || hasBlockingIssues}
              className="btn btn-primary"
              title={hasBlockingIssues ? 'Cannot publish: resolve blocking issues in the Validation Report first.' : ''}
            >
              <UploadCloud size={18} /> {publishMutation.isPending ? 'Publishing...' : 'Publish Live Catalog'}
            </button>
            {hasBlockingIssues && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem', color: '#ef4444', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                Blocked: Check Validation Report
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Publish History */}
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
                  <th className="p-3 text-sm">Stats</th>
                  <th className="p-3 text-sm">Action</th>
                </tr>
              </thead>
              <tbody>
                {publishHistory.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-secondary">No publish history yet.</td></tr>
                )}
                {publishHistory.map((run, idx) => (
                  <tr key={run.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx === 0 ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                    <td className="p-3 text-sm font-mono">{run.id.split('-')[0]}…</td>
                    <td className="p-3 text-sm">{new Date(run.completed_at).toLocaleString()}</td>
                    <td className="p-3 text-sm">{run.show_count} shows, {run.episode_count} eps</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleRollback(run.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        disabled={role !== 'admin' || idx === 0}
                      >
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

      {/* Filters */}
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
        {/* Language filter — spec requirement */}
        <select className="input-field" style={{ width: 'auto' }} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
          <option value="">All Languages</option>
          <option value="en">English</option>
          <option value="hi">Hindi</option>
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
          {shows.map((show: Show) => {
            const isExpanded = selectedShow?.id === show.id;
            return (
              <div key={show.id} className="glass-card flex flex-col justify-between">
                <div className="flex justify-between items-start gap-4 mb-3">
                  {editingShowId === show.id ? (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <input type="text" className="input-field" value={editingShow.title} onChange={e => setEditingShow({ ...editingShow, title: e.target.value })} placeholder="Title" />
                      <select className="input-field" value={editingShow.section || ''} onChange={e => setEditingShow({ ...editingShow, section: e.target.value })}>
                        <option value="">No Section</option>
                        <option value="featured">Featured</option>
                        <option value="series">Series</option>
                        <option value="minisodes">Minisodes</option>
                        <option value="songs">Songs</option>
                      </select>
                      <select className="input-field" value={editingShow.status} onChange={e => setEditingShow({ ...editingShow, status: e.target.value })}>
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

                  {/* Show-level artwork button */}
                  <button
                    onClick={() => {
                      if (showArtworkModalId === show.id) { setShowArtworkModalId(null); }
                      else { setShowArtworkModalId(show.id); fetchShowArtwork(show.id); }
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    <ImageIcon size={14} /> Show Art
                  </button>
                </div>

                {/* Show artwork slots */}
                {showArtworkModalId === show.id && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                    <h4 className="mb-3" style={{ fontSize: '1rem', fontWeight: 600 }}>Show Artwork — {show.title}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      {(['poster', 'banner', 'thumbnail'] as const).map(t => (
                        <ArtworkSlot
                          key={t}
                          type={t}
                          label={`${t.charAt(0).toUpperCase() + t.slice(1)} (${t === 'poster' ? '2:3' : '16:9'})`}
                          dimensions={t === 'poster' ? '~600×900px' : t === 'banner' ? '~1280×720px' : '~640×360px'}
                          artwork={showArtworks.find(a => a.artwork_type === t)}
                          onUpload={async (file) => { await uploadShowArtwork(t, file); }}
                          onDelete={() => {
                            const art = showArtworks.find(a => a.artwork_type === t);
                            if (art) deleteArtwork(art.id, () => fetchShowArtwork(show.id));
                          }}
                          onError={(msg) => addToast('error', msg)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => isExpanded ? setSelectedShow(null) : openShowDetails(show)} className="btn btn-secondary flex items-center justify-center gap-2 mt-2 w-full">
                  <Eye size={16} /> {isExpanded ? 'Collapse' : 'Manage Episodes & Artwork'}
                </button>

                {isExpanded && (
                  <div className="mt-4 animate-fade-in" style={{ padding: '1.5rem', background: 'var(--surface-color-solid)', borderRadius: 'var(--radius-md)' }}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="m-0">Seasons & Episodes</h3>
                      <button onClick={() => setIsCreateEpisodeOpen(true)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Plus size={16} /> New Episode</button>
                    </div>

                    {loadingDetails ? (
                      <div className="flex justify-center p-4"><div className="loader" /></div>
                    ) : showEpisodes.length === 0 ? (
                      <p className="text-secondary">
                        {filterLanguage ? `No episodes in language "${filterLanguage}".` : 'No episodes.'}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {showEpisodes.map(ep => (
                          <div key={ep.id} className="glass-panel flex flex-col gap-4" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                            <div className="flex justify-between items-center">
                              {editingEpisodeId === ep.id ? (
                                <div className="flex flex-wrap items-center gap-2 flex-1">
                                  <input type="text" className="input-field" value={editingEpisode.episode_title} onChange={e => setEditingEpisode({ ...editingEpisode, episode_title: e.target.value })} placeholder="Title" />
                                  <input type="number" className="input-field" style={{ width: '100px' }} value={editingEpisode.duration_seconds || ''} onChange={e => setEditingEpisode({ ...editingEpisode, duration_seconds: e.target.value })} placeholder="Duration (s)" />
                                  <select className="input-field" value={editingEpisode.status} onChange={e => setEditingEpisode({ ...editingEpisode, status: e.target.value })}>
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                  </select>
                                  <button onClick={() => handleUpdateEpisode(ep.id)} className="btn btn-primary px-3 py-2 text-sm">Save</button>
                                  <button onClick={() => setEditingEpisodeId(null)} className="btn btn-secondary px-3 py-2 text-sm">Cancel</button>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    {ep.content_group.includes('-s00') || ep.episode_number === 0 ? (
                                      <span className="badge badge-warning">Trailer</span>
                                    ) : (
                                      <span className="badge badge-primary">Ep {ep.episode_number}</span>
                                    )}
                                    <strong className="flex items-center gap-2" style={{ fontSize: '1.1rem' }}>
                                      {ep.episode_title}
                                      <button onClick={() => { setEditingEpisodeId(ep.id); setEditingEpisode(ep); }} className="text-secondary hover:text-primary"><Edit2 size={14} /></button>
                                    </strong>
                                  </div>
                                  <div className="flex gap-4 text-sm text-secondary">
                                    <span><Globe size={13} className="inline mr-1" /> {ep.language}</span>
                                    <span><Layers size={13} className="inline mr-1" /> {ep.content_group}</span>
                                    <span><Clock size={13} className="inline mr-1" /> {ep.duration_seconds ? `${Math.floor(ep.duration_seconds / 60)}m ${ep.duration_seconds % 60}s` : 'No duration'}</span>
                                    <span className={`badge ${ep.status === 'published' ? 'badge-success' : 'badge-warning'} text-[0.65rem] px-1 py-0`}>{ep.status}</span>
                                  </div>
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  if (uploadModalEpisode?.id === ep.id) { setUploadModalEpisode(null); }
                                  else { setUploadModalEpisode(ep); fetchEpisodeArtwork(ep.id); }
                                }}
                                className="btn btn-secondary px-4 py-2 text-sm"
                              >
                                {uploadModalEpisode?.id === ep.id ? 'Close Artwork' : 'Manage Artwork'}
                              </button>
                            </div>

                            {/* 3-Slot Episode Artwork */}
                            {uploadModalEpisode?.id === ep.id && (
                              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                                <h4 className="mb-4" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Artwork — {ep.episode_title}</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                  {(['poster', 'banner', 'thumbnail'] as const).map(t => (
                                    <ArtworkSlot
                                      key={t}
                                      type={t}
                                      label={`${t.charAt(0).toUpperCase() + t.slice(1)} (${t === 'poster' ? '2:3' : '16:9'})`}
                                      dimensions={t === 'poster' ? '~600×900px' : t === 'banner' ? '~1280×720px' : '~640×360px'}
                                      artwork={episodeArtworks.find(a => a.artwork_type === t)}
                                      onUpload={async (file) => { await uploadEpisodeArtwork(t, file); }}
                                      onDelete={() => {
                                        const art = episodeArtworks.find(a => a.artwork_type === t);
                                        if (art) deleteArtwork(art.id, () => fetchEpisodeArtwork(ep.id));
                                      }}
                                      onError={(msg) => addToast('error', msg)}
                                    />
                                  ))}
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

      {/* Pagination */}
      <div className="flex justify-center items-center gap-4 mt-8">
        <button className="btn btn-secondary" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}><ChevronLeft size={16} /> Prev</button>
        <span>Page {page + 1}</span>
        <button className="btn btn-secondary" onClick={() => setPage(page + 1)} disabled={shows.length < limit}>Next <ChevronRight size={16} /></button>
      </div>

      <CreateShowModal
        isOpen={isCreateShowOpen}
        onClose={() => setIsCreateShowOpen(false)}
        newShow={newShow}
        setNewShow={setNewShow}
        onSubmit={handleCreateShow}
      />

      <CreateEpisodeModal
        isOpen={isCreateEpisodeOpen && !!selectedShow}
        onClose={() => setIsCreateEpisodeOpen(false)}
        showTitle={selectedShow?.title}
        newEpisode={newEpisode}
        setNewEpisode={setNewEpisode as any}
        onSubmit={handleCreateEpisode}
      />
    </div>
  );
};

export default Dashboard;
