import React, { useState, useRef } from 'react';
import { Trash2, Image as ImageIcon } from 'lucide-react';

interface Artwork {
  id: string;
  artwork_type: string;
  storage_path: string;
  width_px: number;
  height_px: number;
}

export const ArtworkSlot: React.FC<{
  type: string;
  label: string;
  dimensions: string;
  artwork?: Artwork;
  onUpload: (f: File) => Promise<void>;
  onDelete?: () => void;
  onError?: (msg: string) => void;
}> = ({ type, label, dimensions, artwork, onUpload, onDelete, onError }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err: any) {
      setPreview(null);
      const msg = err.response?.data?.detail || 'Upload failed.';
      onError?.(msg);
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-uploaded after fixing
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ background: '#27272a', padding: '1rem', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', border: '1px solid #52525b' }}>
      {artwork && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); setPreview(null); }}
          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(239,68,68,0.9)', padding: '0.25rem', borderRadius: '4px', zIndex: 10, border: 'none', cursor: 'pointer' }}
          title="Delete Artwork"
        >
          <Trash2 size={14} color="white" />
        </button>
      )}
      <div>
        <h5 style={{ margin: 0, color: 'white', fontWeight: 500 }}>{label}</h5>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{dimensions}</span>
      </div>

      <div
        style={{ aspectRatio: type === 'poster' ? '2/3' : '16/9', background: '#18181b', borderRadius: '0.25rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: uploading ? 'wait' : 'pointer' }}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: uploading ? 0.5 : 0.8 }} />
        ) : artwork ? (
          <img src={`${API_BASE}/storage/${artwork.storage_path}`} alt="current" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
        ) : (
          <ImageIcon size={24} color="#4b5563" />
        )}

        {!uploading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, background: 'rgba(0,0,0,0.5)', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Upload</span>
          </div>
        )}
      </div>
      <input type="file" ref={fileRef} accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
};
