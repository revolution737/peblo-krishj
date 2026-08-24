import React from 'react';
import { X } from 'lucide-react';

export interface NewEpisodeState {
  episode_number: number;
  episode_title: string;
  language: string;
  content_group: string;
  duration_seconds: string;
  status: string;
}

interface CreateEpisodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  showTitle?: string;
  newEpisode: NewEpisodeState;
  setNewEpisode: (ep: NewEpisodeState) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const CreateEpisodeModal: React.FC<CreateEpisodeModalProps> = ({ isOpen, onClose, showTitle, newEpisode, setNewEpisode, onSubmit }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        <h2 style={{ marginTop: 0 }}>Add Episode to {showTitle}</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-4">
          <input className="input-field" type="number" placeholder="Episode Number" required value={newEpisode.episode_number} onChange={e => setNewEpisode({ ...newEpisode, episode_number: parseInt(e.target.value) })} />
          <input className="input-field" placeholder="Episode Title" required value={newEpisode.episode_title} onChange={e => setNewEpisode({ ...newEpisode, episode_title: e.target.value })} />
          <input className="input-field" placeholder="Content Group (e.g. show-s01e01)" required value={newEpisode.content_group} onChange={e => setNewEpisode({ ...newEpisode, content_group: e.target.value })} />
          <select className="input-field" value={newEpisode.language} onChange={e => setNewEpisode({ ...newEpisode, language: e.target.value })}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
          <input className="input-field" type="number" placeholder="Duration (seconds)" value={newEpisode.duration_seconds} onChange={e => setNewEpisode({ ...newEpisode, duration_seconds: e.target.value })} />
          <select className="input-field" value={newEpisode.status} onChange={e => setNewEpisode({ ...newEpisode, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <button type="submit" className="btn btn-primary mt-2">Create Episode</button>
        </form>
      </div>
    </div>
  );
};
