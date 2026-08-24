import React from 'react';
import { X } from 'lucide-react';

export interface NewShowState {
  title: string;
  slug: string;
  section: string;
  synopsis: string;
  categories: string;
  status: string;
}

interface CreateShowModalProps {
  isOpen: boolean;
  onClose: () => void;
  newShow: NewShowState;
  setNewShow: (show: NewShowState) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const CreateShowModal: React.FC<CreateShowModalProps> = ({ isOpen, onClose, newShow, setNewShow, onSubmit }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        <h2 style={{ marginTop: 0 }}>Create New Show</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-4">
          <input className="input-field" placeholder="Title" required value={newShow.title} onChange={e => setNewShow({ ...newShow, title: e.target.value })} />
          <input className="input-field" placeholder="Slug (e.g. my-show)" required value={newShow.slug} onChange={e => setNewShow({ ...newShow, slug: e.target.value })} />
          <select className="input-field" value={newShow.section} onChange={e => setNewShow({ ...newShow, section: e.target.value })}>
            <option value="">No Section</option>
            <option value="featured">Featured</option>
            <option value="series">Series</option>
            <option value="minisodes">Minisodes</option>
            <option value="songs">Songs</option>
          </select>
          <textarea className="input-field" placeholder="Synopsis" value={newShow.synopsis} onChange={e => setNewShow({ ...newShow, synopsis: e.target.value })} />
          <input className="input-field" placeholder="Categories (comma separated)" value={newShow.categories} onChange={e => setNewShow({ ...newShow, categories: e.target.value })} />
          <select className="input-field" value={newShow.status} onChange={e => setNewShow({ ...newShow, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <button type="submit" className="btn btn-primary mt-2">Create Show</button>
        </form>
      </div>
    </div>
  );
};
