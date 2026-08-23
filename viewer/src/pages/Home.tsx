import React, { useEffect, useState } from 'react';
import { Play, Info, X, Film } from 'lucide-react';
import api from '../api';

const Home: React.FC = () => {
  const [catalog, setCatalog] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedShow, setSelectedShow] = useState<any>(null);

  const languageOptions = [
    { code: '', label: 'All Languages' },
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' }
  ];

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.append('q', search.trim());
        if (language) params.append('language', language);
        
        const url = params.toString() ? `/catalog/search?${params.toString()}` : `/catalog`;
        const res = await api.get(url);
        setCatalog(res.data);
      } catch (err) {
        console.error("Failed to fetch catalog", err);
      } finally {
        setLoading(false);
      }
    };
    
    const timer = setTimeout(() => {
      fetchCatalog();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, language]);

  // Handle scroll for navbar styling
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getArtwork = (show: any, type: string) => {
    const seed = (show?.title || 'show').length;
    if (type === 'banner') return `https://picsum.photos/seed/${seed}banner/1280/720`;
    if (type === 'poster') return `https://picsum.photos/seed/${seed}poster/600/900`;
    if (type === 'thumbnail') return `https://picsum.photos/seed/${seed}thumb/640/360`;
    return '';
  };

  if (loading && !catalog) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid rgba(0,0,0,0.05)', borderTopColor: 'var(--brand-yellow)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
          <p>Loading Peblo TV...</p>
        </div>
      </div>
    );
  }

  const sections = Array.isArray(catalog?.sections) ? catalog.sections : [];
  const heroShow = sections[0]?.shows?.[0];

  return (
    <div>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="brand">PEBLO TV</div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search for shows or episodes..." 
            className="search-bar"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="custom-dropdown-container">
            <button 
              className="language-select"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              {languageOptions.find(o => o.code === language)?.label || 'All Languages'}
            </button>
            
            {dropdownOpen && (
              <div className="custom-dropdown-menu">
                {languageOptions.map(option => (
                  <div 
                    key={option.code}
                    className={`custom-dropdown-item ${language === option.code ? 'active' : ''}`}
                    onClick={() => {
                      setLanguage(option.code);
                      setDropdownOpen(false);
                    }}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {!search && !language && heroShow && (
        <div className="hero" style={{ backgroundImage: `url(${getArtwork(heroShow, 'banner')})` }}>
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <h1 className="hero-title">{heroShow.title}</h1>
            <p className="hero-synopsis">{heroShow.synopsis}</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-play" onClick={() => setSelectedShow(heroShow)}>
                <Play fill="black" size={20} /> Play
              </button>
              <button className="btn btn-info" onClick={() => setSelectedShow(heroShow)}>
                <Info size={20} /> More Info
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: (!search && !language && heroShow) ? '-80px' : '90px', position: 'relative', zIndex: 20 }}>
        {sections.length === 0 ? (
          <div style={{ padding: '6rem 4%', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Film size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <h2>{search ? `No results found for "${search}"` : 'Catalogue is currently empty.'}</h2>
            <p style={{ marginTop: '0.5rem' }}>
              {search ? 'Try searching for another keyword or language variant.' : 'Publish the catalogue from the CMS to start browsing.'}
            </p>
          </div>
        ) : (
          sections.map((section: any, idx: number) => (
            <div key={idx} className="row">
              <h2 className="row-title">{section.name || section.section || 'Featured'}</h2>
              <div className="row-posters">
                {(section.shows || []).map((show: any) => (
                  <img 
                    key={show.slug || show.id} 
                    src={getArtwork(show, 'poster')} 
                    alt={show.title} 
                    className="poster"
                    onClick={() => setSelectedShow(show)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedShow && (
        <div className="modal-overlay" onClick={() => setSelectedShow(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedShow(null)}>
              <X size={20} />
            </button>
            
            <div style={{ 
              height: '360px', 
              backgroundImage: `url(${getArtwork(selectedShow, 'banner')})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center', 
              position: 'relative' 
            }}>
               <div className="hero-overlay" style={{ background: 'linear-gradient(to top, var(--bg-secondary) 0%, transparent 100%)' }}></div>
               <div style={{ position: 'absolute', bottom: '2rem', left: '2.5rem' }}>
                 <h1 className="hero-title" style={{ fontSize: '3rem', color: 'var(--text-primary)' }}>{selectedShow.title}</h1>
                 <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button className="btn btn-play" onClick={() => alert(`Playing ${selectedShow.title}`)}>
                      <Play fill="black" size={18} /> Play
                    </button>
                 </div>
               </div>
            </div>

            <div style={{ padding: '2rem 2.5rem' }}>
              <p style={{ fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
                {selectedShow.synopsis || 'No synopsis available.'}
              </p>
              
              <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem', color: 'var(--brand-purple)' }}>
                Episodes
              </h3>
              
              {(selectedShow.seasons || [])
                .filter((s: any) => s.season_number !== 0) // DOMAIN RULE 1: STRICTLY FILTER SEASON 0 (TRAILERS)
                .sort((a: any, b: any) => a.season_number - b.season_number)
                .map((season: any) => (
                <div key={season.season_number} style={{ marginBottom: '2rem' }}>
                  <h4 style={{ color: 'var(--accent-color)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Season {season.season_number}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(season.episodes || [])
                      .sort((a: any, b: any) => a.episode_number - b.episode_number)
                      .map((ep: any) => (
                      <div key={ep.episode_number} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem', background: '#ffffff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}>
                         <span style={{ color: 'var(--brand-cyan)', fontSize: '1.5rem', fontWeight: '800', width: '32px', textAlign: 'center' }}>
                           {ep.episode_number}
                         </span>
                         <img 
                           src={getArtwork(selectedShow, 'thumbnail')} 
                           style={{ width: '140px', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '12px' }} 
                           alt="Thumbnail" 
                         />
                         <div style={{ flex: 1 }}>
                           <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>{ep.title}</h4>
                           <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                             {ep.duration_seconds && (
                               <span>Duration: <strong style={{ color: 'var(--text-secondary)' }}>{Math.floor(ep.duration_seconds / 60)}m {ep.duration_seconds % 60}s</strong></span>
                             )}
                             <span>Languages: <strong style={{ color: 'var(--text-secondary)' }}>{(ep.languages || []).join(', ') || 'en'}</strong></span>
                           </div>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
