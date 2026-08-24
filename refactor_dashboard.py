import sys

with open('cms/src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# 1. Replace imports and remove Toast logic
import_addition = """
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import { ArtworkSlot } from '../components/ArtworkSlot';
import { CreateShowModal, NewShowState } from '../components/CreateShowModal';
import { CreateEpisodeModal, NewEpisodeState } from '../components/CreateEpisodeModal';
"""

content = content.replace("import api from '../api';", "import api from '../api';\n" + import_addition)

# Remove the inline Toast interfaces and logic
# It starts at "interface Toast {" and ends at "  );
# };" just before Data fetcher
import re
content = re.sub(r'interface Toast \{.*?\};\n', '', content, flags=re.DOTALL)

# 2. Replace the toast state with the hook
toast_state_old = """  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((type: 'success' | 'error', text: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));"""

toast_state_new = """  // Toasts
  const { toasts, addToast, dismissToast } = useToast();"""

content = content.replace(toast_state_old, toast_state_new)

# 3. Replace modals
create_show_modal_old = """      {/* Create Show Modal */}
      {isCreateShowOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateShowOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsCreateShowOpen(false)}><X size={20} /></button>
            <h2 style={{ marginTop: 0 }}>Create New Show</h2>
            <form onSubmit={handleCreateShow} className="flex flex-col gap-4 mt-4">
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
      )}"""

create_show_modal_new = """      <CreateShowModal
        isOpen={isCreateShowOpen}
        onClose={() => setIsCreateShowOpen(false)}
        newShow={newShow}
        setNewShow={setNewShow}
        onSubmit={handleCreateShow}
      />"""

content = content.replace(create_show_modal_old, create_show_modal_new)

create_episode_modal_old = """      {/* Create Episode Modal */}
      {isCreateEpisodeOpen && selectedShow && (
        <div className="modal-overlay" onClick={() => setIsCreateEpisodeOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsCreateEpisodeOpen(false)}><X size={20} /></button>
            <h2 style={{ marginTop: 0 }}>Add Episode to {selectedShow.title}</h2>
            <form onSubmit={handleCreateEpisode} className="flex flex-col gap-4 mt-4">
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
      )}"""

create_episode_modal_new = """      <CreateEpisodeModal
        isOpen={isCreateEpisodeOpen && !!selectedShow}
        onClose={() => setIsCreateEpisodeOpen(false)}
        showTitle={selectedShow?.title}
        newEpisode={newEpisode}
        setNewEpisode={setNewEpisode as any}
        onSubmit={handleCreateEpisode}
      />"""

content = content.replace(create_episode_modal_old, create_episode_modal_new)

# 4. Remove ArtworkSlot component at the end
# find "// ArtworkSlot component"
idx = content.find("// ─────────────────────────────────────────────────────────────\n// ArtworkSlot component")
if idx != -1:
    end_idx = content.find("export default Dashboard;", idx)
    content = content[:idx] + content[end_idx:]

with open('cms/src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)

print("Refactored Dashboard.tsx")
