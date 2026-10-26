import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Banner } from '../types';
import {
  getBanners,
  saveBanner,
  deleteBanner
} from '../services/firestoreService';
import {
  Tv,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Eye,
  Sparkles
} from 'lucide-react';

export const BannerManagerView: React.FC = () => {
  const { currentUser, effectiveRole } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Editor Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [active, setActive] = useState(true);
  const [priority, setPriority] = useState(10);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const data = await getBanners();
      // Sort by priority descending
      data.sort((a, b) => b.priority - a.priority);
      setBanners(data);
    } catch (err) {
      console.error('Failed to load banners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const openCreateModal = () => {
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + 30);

    setEditingId(null);
    setTitle('');
    setImageUrl('https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80');
    setLinkUrl('/routines');
    setActive(true);
    setPriority(10);
    setStartAt(now.toISOString().substring(0, 16));
    setEndAt(end.toISOString().substring(0, 16));
    setIsModalOpen(true);
  };

  const openEditModal = (b: Banner) => {
    setEditingId(b.id);
    setTitle(b.title);
    setImageUrl(b.imageUrl);
    setLinkUrl(b.linkUrl || '');
    setActive(b.active);
    setPriority(b.priority);
    setStartAt(new Date(b.startAt).toISOString().substring(0, 16));
    setEndAt(new Date(b.endAt).toISOString().substring(0, 16));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!imageUrl.startsWith('https://')) {
      setFeedback({ text: 'Banner image URL must start with https://', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      await saveBanner({
        id: editingId || undefined,
        title,
        imageUrl,
        linkUrl,
        active,
        priority: Number(priority),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        createdBy: currentUser?.uid,
      });

      setIsModalOpen(false);
      await loadBanners();
      setFeedback({ text: `Banner "${title}" saved successfully.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to save banner.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: Banner) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete banner "${b.title}"?`)) return;
    try {
      await deleteBanner(b.id);
      await loadBanners();
      setFeedback({ text: `Banner "${b.title}" removed.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to delete banner.',
        type: 'error'
      });
    }
  };

  // Compute active banner for TV display simulation
  const nowTime = Date.now();
  const currentlyActiveBanners = banners
    .filter(b => b.active && new Date(b.startAt).getTime() <= nowTime && new Date(b.endAt).getTime() >= nowTime)
    .sort((a, b) => b.priority - a.priority);

  const activeTvBanner = currentlyActiveBanners[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E4DF] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#171615] tracking-tight">
              LG webOS TV Banner Manager
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 bg-[#FEF3C7] text-[#92400E] rounded">
              Admin Console
            </span>
          </div>
          <p className="text-xs text-[#6E6C67] mt-1">
            Schedule temporary promotional and instructional banners displayed in the top slot of the LG webOS TV companion home screen.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Banner</span>
          </button>
        )}
      </div>

      {/* Live TV Screen Banner Simulator */}
      <div className="bg-[#171615] text-white rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between text-xs border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2 text-neutral-400">
            <Tv className="w-4 h-4 text-[#B45309]" />
            <span className="font-semibold text-white">LG webOS Home Screen Simulation</span>
            <span aria-hidden="true">·</span>
            <span>Resolution 1920×1080 (Slot 16:9 Banner)</span>
          </div>
          <div className="text-[11px] text-neutral-400 font-numeric">
            {currentlyActiveBanners.length} scheduled active banner(s)
          </div>
        </div>

        {activeTvBanner ? (
          <div className="relative h-56 sm:h-72 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
            <img
              src={activeTvBanner.imageUrl}
              alt={activeTvBanner.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex flex-col justify-end p-6">
              <span className="text-[11px] tracking-wider uppercase font-semibold text-[#F59E0B] mb-1">
                Active TV Slot (Priority #{activeTvBanner.priority})
              </span>
              <h3 className="text-lg sm:text-2xl font-bold text-white max-w-2xl leading-tight">
                {activeTvBanner.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-neutral-300 mt-2 font-numeric">
                <span>Start: {new Date(activeTvBanner.startAt).toLocaleDateString()}</span>
                <span aria-hidden="true">·</span>
                <span>Ends: {new Date(activeTvBanner.endAt).toLocaleDateString()}</span>
                {activeTvBanner.linkUrl && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#FBBF24]">Action: {activeTvBanner.linkUrl}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-44 rounded-xl border border-dashed border-neutral-800 flex flex-col items-center justify-center text-center p-6 space-y-2">
            <Tv className="w-8 h-8 text-neutral-600" />
            <div className="text-sm font-semibold text-neutral-300">No active banner scheduled for right now</div>
            <p className="text-xs text-neutral-500 max-w-sm">
              The TV falls back to its default ambient workout primer placeholder.
            </p>
          </div>
        )}
      </div>

      {/* Banner Management List */}
      <div className="bg-white border border-[#E6E4DF] rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#171615]">All Configured Banners</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 bg-[#FAFAF8] rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : banners.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#E6E4DF] rounded-lg space-y-2">
            <p className="text-xs text-[#6E6C67]">No banners created yet.</p>
            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="text-xs font-semibold text-[#B45309] hover:underline cursor-pointer"
              >
                Create your first promotional banner
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#F3F1EC]">
            {banners.map((banner) => {
              const isCurrentlyActive = banner.active &&
                new Date(banner.startAt).getTime() <= nowTime &&
                new Date(banner.endAt).getTime() >= nowTime;

              return (
                <div
                  key={banner.id}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-16 bg-[#171615] rounded-lg overflow-hidden shrink-0 border border-[#E6E4DF]">
                      <img
                        src={banner.imageUrl}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-[#171615]">{banner.title}</h4>
                        {isCurrentlyActive ? (
                          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Live on TV</span>
                          </span>
                        ) : banner.active ? (
                          <span className="text-xs text-amber-700 font-medium">Scheduled</span>
                        ) : (
                          <span className="text-xs text-neutral-400">Disabled</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6E6C67] mt-1 font-numeric">
                        <span>Priority weight: <strong>{banner.priority}</strong></span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(banner.startAt).toLocaleDateString()} → {new Date(banner.endAt).toLocaleDateString()}</span>
                        {banner.linkUrl && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Deep-link: {banner.linkUrl}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => openEditModal(banner)}
                        className="p-1.5 text-[#6E6C67] hover:text-[#171615] rounded hover:bg-[#F3F1EC] transition-colors cursor-pointer"
                        title="Edit banner"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(banner)}
                        className="p-1.5 text-red-600 hover:text-red-800 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete banner"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Add/Edit Banner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6E4DF] rounded-xl max-w-xl w-full p-6 sm:p-8 my-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-[#6E6C67] hover:text-[#171615] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#171615]">
                {editingId ? 'Edit TV Banner' : 'Create TV Banner'}
              </h2>
              <p className="text-xs text-[#6E6C67] mt-1">
                Set headline, artwork URL, priority rating, and scheduling window.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#171615] mb-1">Banner Title *</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer Fitness Intensive: Register by June 1"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#171615] mb-1">Image HTTPS URL *</label>
                <input
                  type="url"
                  required
                  pattern="^https://.+"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] font-numeric"
                />
                {imageUrl && (
                  <div className="mt-2 h-28 rounded-lg overflow-hidden bg-neutral-900 border border-[#E6E4DF]">
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Optional Route / Link</label>
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="/routines or custom link"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Priority (Higher wins)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] font-numeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Start Display Date/Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] font-numeric"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">End Display Date/Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] font-numeric"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeToggle"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-[#D1CFCA] text-[#171615] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="activeToggle" className="text-xs font-medium text-[#171615] cursor-pointer">
                  Enable and publish this banner
                </label>
              </div>

              <div className="pt-4 border-t border-[#F3F1EC] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#6E6C67] hover:text-[#171615] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
