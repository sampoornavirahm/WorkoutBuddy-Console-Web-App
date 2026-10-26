import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Routine, RoutineItem, Exercise } from '../types';
import {
  getRoutines,
  saveRoutine,
  duplicateRoutine,
  deleteRoutine,
  getExercises
} from '../services/firestoreService';
import {
  Plus,
  Edit3,
  Copy,
  Trash2,
  Clock,
  Dumbbell,
  ArrowUp,
  ArrowDown,
  Play,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  Lock,
  Globe,
  Sliders,
  Sparkles
} from 'lucide-react';

export const RoutineBuilderView: React.FC = () => {
  const { currentUser, effectiveRole } = useAuth();
  const isProOrAdmin = effectiveRole === 'pro' || effectiveRole === 'admin';
  const isAdmin = effectiveRole === 'admin';

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Strength & Conditioning');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [visibility, setVisibility] = useState<'private' | 'public'>('public');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('published');
  const [items, setItems] = useState<RoutineItem[]>([]);

  // Exercise Picker Drawer in Editor
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [previewMediaUrl, setPreviewMediaUrl] = useState<{ url: string; type: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rts, exs] = await Promise.all([
        getRoutines(currentUser?.uid, effectiveRole),
        getExercises(),
      ]);
      setRoutines(rts);
      setExercises(exs.filter(e => e.status === 'published' || isProOrAdmin));
    } catch (err) {
      console.error('Error loading routines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, effectiveRole]);

  // Compute total estimated duration of routine in seconds
  const calculateTotalDuration = (routineItems: RoutineItem[]): number => {
    return routineItems.reduce((acc, it) => {
      const work = it.workSeconds && it.workSeconds > 0 ? it.workSeconds : (it.reps * 3);
      const setTime = (work + it.restSeconds) * it.sets;
      return acc + setTime;
    }, 0);
  };

  const openNewRoutineModal = () => {
    setEditingRoutineId(null);
    setName('');
    setDescription('');
    setCategory('Strength & Conditioning');
    setDifficulty('beginner');
    setVisibility('public');
    setStatus('published');
    setItems([]);
    setIsEditorOpen(true);
  };

  const openEditRoutineModal = (rt: Routine) => {
    setEditingRoutineId(rt.id);
    setName(rt.name);
    setDescription(rt.description || '');
    setCategory(rt.category || 'Strength & Conditioning');
    setDifficulty(rt.difficulty);
    setVisibility(rt.visibility);
    setStatus(rt.status);
    setItems(rt.items || []);
    setIsEditorOpen(true);
  };

  const handleAddExerciseToRoutine = (exercise: Exercise) => {
    const newItem: RoutineItem = {
      id: 'item_' + Math.random().toString(36).substring(2, 9),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      mediaUrl: exercise.mediaUrl,
      mediaType: exercise.mediaType,
      position: items.length + 1,
      sets: 3,
      reps: 12,
      workSeconds: 30,
      restSeconds: 30,
      instructions: exercise.instructions[0] || 'Maintain proper form and tempo.',
    };
    setItems([...items, newItem]);
    setIsPickerOpen(false);
  };

  const handleUpdateItem = (index: number, patch: Partial<RoutineItem>) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    setItems(prev => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((it, idx) => ({ ...it, position: idx + 1 }));
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index).map((it, idx) => ({ ...it, position: idx + 1 })));
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (items.length === 0) {
      setFeedback({ text: 'Please add at least one exercise to the routine.', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const estimatedDurationSeconds = calculateTotalDuration(items);

      await saveRoutine({
        id: editingRoutineId || undefined,
        ownerUid: currentUser.uid,
        ownerName: currentUser.displayName || currentUser.email || 'Athlete',
        name,
        description,
        category,
        difficulty,
        visibility,
        status,
        items,
        estimatedDurationSeconds,
      });

      setIsEditorOpen(false);
      await loadData();
      setFeedback({ text: `Routine "${name}" saved and synced for LG TV.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to save routine.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (routine: Routine) => {
    if (!currentUser) return;
    try {
      await duplicateRoutine(routine, currentUser.uid);
      await loadData();
      setFeedback({ text: `Duplicated "${routine.name}".`, type: 'success' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to duplicate routine.',
        type: 'error'
      });
    }
  };

  const handleDelete = async (routine: Routine) => {
    if (!window.confirm(`Delete routine "${routine.name}"?`)) return;
    try {
      await deleteRoutine(routine.id);
      await loadData();
      setFeedback({ text: `Routine "${routine.name}" deleted.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to delete routine.',
        type: 'error'
      });
    }
  };

  const formatMinutes = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    return mins <= 1 ? '1 min' : `${mins} mins`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
              Workout Routine Builder
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 bg-[#FEF3C7] text-[#92400E] rounded">
              Pro & Admin
            </span>
          </div>
          <p className="text-xs text-[#6E6C67] mt-1">
            Build structured workout circuits with work intervals, set counts, and rest periods consumed by LG webOS TV companion.
          </p>
        </div>

        <button
          onClick={openNewRoutineModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Routine</span>
        </button>
      </div>

      {/* Routine Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 bg-white border border-[#E6E4DF] rounded-xl animate-pulse p-6"></div>
          ))}
        </div>
      ) : routines.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-[#D1CFCA] rounded-xl space-y-3">
          <Dumbbell className="w-8 h-8 text-[#9C9A94] mx-auto" />
          <h3 className="text-sm font-semibold text-[#171615]">No routines configured yet</h3>
          <p className="text-xs text-[#6E6C67] max-w-sm mx-auto">
            Design your first workout routine to push to your connected LG webOS TV companion.
          </p>
          <button
            onClick={openNewRoutineModal}
            className="px-4 py-2 bg-[#171615] text-white text-xs font-semibold rounded-lg hover:bg-[#2A2926] cursor-pointer shadow-xs"
          >
            Create Your First Routine
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="bg-white border border-[#E6E4DF] hover:border-[#D1CFCA] rounded-xl p-5 flex flex-col justify-between space-y-4 transition-all hover:shadow-xs group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-bold text-base text-[#171615] group-hover:text-[#B45309] transition-colors">
                    {routine.name}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-[#6E6C67] shrink-0 font-medium">
                    {routine.visibility === 'public' ? (
                      <span title="Public routine"><Globe className="w-3.5 h-3.5 text-emerald-600" /></span>
                    ) : (
                      <span title="Private routine"><Lock className="w-3.5 h-3.5 text-neutral-400" /></span>
                    )}
                    <span className="capitalize">{routine.status}</span>
                  </div>
                </div>

                <p className="text-xs text-[#6E6C67] line-clamp-2 leading-relaxed">
                  {routine.description || 'No description provided.'}
                </p>

                {/* Unboxed Metadata with · separator */}
                <div className="mt-3 text-xs text-[#6E6C67] flex flex-wrap items-center gap-1.5 font-numeric">
                  <span className="text-[#171615] font-medium">{routine.items.length} exercises</span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#9C9A94]" />
                    <span>{formatMinutes(routine.estimatedDurationSeconds)}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{routine.difficulty}</span>
                </div>

                {/* Preview of first 3 exercises */}
                <div className="mt-4 pt-3 border-t border-[#F3F1EC] space-y-1">
                  {routine.items.slice(0, 3).map((item, idx) => (
                    <div key={item.id} className="text-xs text-[#171615] flex items-center justify-between">
                      <span className="truncate pr-2">
                        {idx + 1}. {item.exerciseName}
                      </span>
                      <span className="font-numeric text-[#9C9A94] text-[11px] shrink-0">
                        {item.sets}×{item.reps > 1 ? `${item.reps}r` : `${item.workSeconds}s`}
                      </span>
                    </div>
                  ))}
                  {routine.items.length > 3 && (
                    <div className="text-[11px] text-[#9C9A94] italic pt-0.5">
                      +{routine.items.length - 3} more exercises...
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#F3F1EC] flex items-center justify-between text-xs">
                <span className="text-[#9C9A94] text-[11px] truncate max-w-[120px]">
                  {routine.ownerName || 'Personal'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicate(routine)}
                    className="p-1.5 text-[#6E6C67] hover:text-[#171615] rounded hover:bg-[#F3F1EC] transition-colors cursor-pointer"
                    title="Duplicate routine"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => openEditRoutineModal(routine)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#171615] bg-[#F3F1EC] hover:bg-[#EAE7E0] rounded transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDelete(routine)}
                    className="p-1.5 text-red-600 hover:text-red-800 rounded hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete routine"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Routine Editor Full Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6E4DF] rounded-xl max-w-4xl w-full p-6 sm:p-8 my-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsEditorOpen(false)}
              className="absolute top-5 right-5 text-[#6E6C67] hover:text-[#171615] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#171615]">
                {editingRoutineId ? 'Edit Workout Routine' : 'Build New Workout Routine'}
              </h2>
              <p className="text-xs text-[#6E6C67] mt-1">
                Sequence exercises, intervals, and rest breaks. Changes sync in real-time to paired LG webOS TVs.
              </p>
            </div>

            <form onSubmit={handleSaveRoutine} className="space-y-6">
              {/* Basic Routine Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Routine Title *</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Morning Athletic Flow"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. HIIT, Core, Strength"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#171615] mb-1">Description</label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Target training goals, warm-up tips, and intensity pacing..."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">TV Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  >
                    <option value="public">Public (Visible to All TVs)</option>
                    <option value="private">Private (Only Your Paired TV)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Publish Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft (Work in progress)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Exercise Items List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#171615]">Exercise Circuit</h3>
                    <span className="text-xs text-[#6E6C67] font-numeric">
                      Total: ~{formatMinutes(calculateTotalDuration(items))} ({items.length} exercises)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Exercise</span>
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="p-8 border border-dashed border-[#D1CFCA] rounded-xl text-center space-y-2">
                    <p className="text-xs text-[#6E6C67]">No exercises added to this routine yet.</p>
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(true)}
                      className="text-xs font-semibold text-[#B45309] hover:underline cursor-pointer"
                    >
                      Browse catalogue to add exercises
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-4 bg-[#FAFAF8] border border-[#E6E4DF] rounded-xl space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#171615] text-white text-xs flex items-center justify-center font-numeric font-medium">
                              {index + 1}
                            </span>
                            <span className="font-semibold text-sm text-[#171615]">
                              {item.exerciseName}
                            </span>
                            {item.mediaUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewMediaUrl({
                                    url: item.mediaUrl!,
                                    type: item.mediaType || 'image/gif',
                                    title: item.exerciseName,
                                  })
                                }
                                className="text-xs text-[#B45309] hover:underline flex items-center gap-1 cursor-pointer ml-2"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Preview</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveItem(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-[#6E6C67] hover:text-[#171615] disabled:opacity-30 cursor-pointer"
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(index, 'down')}
                              disabled={index === items.length - 1}
                              className="p-1 text-[#6E6C67] hover:text-[#171615] disabled:opacity-30 cursor-pointer"
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1 text-red-600 hover:text-red-800 cursor-pointer ml-1"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Sets, Reps, Work seconds, Rest seconds */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] text-[#6E6C67] mb-1">Sets</label>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={item.sets}
                              onChange={(e) => handleUpdateItem(index, { sets: Number(e.target.value) || 1 })}
                              className="w-full px-2.5 py-1.5 bg-white border border-[#D1CFCA] rounded font-numeric"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-[#6E6C67] mb-1">Reps (or 0 for timed)</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={item.reps}
                              onChange={(e) => handleUpdateItem(index, { reps: Number(e.target.value) || 0 })}
                              className="w-full px-2.5 py-1.5 bg-white border border-[#D1CFCA] rounded font-numeric"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-[#6E6C67] mb-1">Work Interval (sec)</label>
                            <input
                              type="number"
                              min={5}
                              max={300}
                              value={item.workSeconds || 30}
                              onChange={(e) => handleUpdateItem(index, { workSeconds: Number(e.target.value) || 30 })}
                              className="w-full px-2.5 py-1.5 bg-white border border-[#D1CFCA] rounded font-numeric"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-[#6E6C67] mb-1">Rest Interval (sec)</label>
                            <input
                              type="number"
                              min={0}
                              max={300}
                              value={item.restSeconds}
                              onChange={(e) => handleUpdateItem(index, { restSeconds: Number(e.target.value) || 0 })}
                              className="w-full px-2.5 py-1.5 bg-white border border-[#D1CFCA] rounded font-numeric"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-[#F3F1EC] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#6E6C67] hover:text-[#171615] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || items.length === 0}
                  className="px-5 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                >
                  {saving ? 'Syncing...' : 'Save & Publish to LG TV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exercise Catalogue Picker Drawer */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E6E4DF] rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E4DF]">
              <div>
                <h3 className="font-bold text-base text-[#171615]">Select Exercise from Catalogue</h3>
                <p className="text-xs text-[#6E6C67]">Choose an exercise to add to the circuit sequence.</p>
              </div>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="text-[#6E6C67] hover:text-[#171615] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search exercise..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAFAF8] border border-[#D1CFCA] rounded-lg focus:outline-none"
            />

            <div className="flex-1 overflow-y-auto divide-y divide-[#F3F1EC]">
              {exercises
                .filter(e => e.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                  e.primaryMuscles.some(m => m.toLowerCase().includes(pickerSearch.toLowerCase())))
                .map((ex) => (
                  <div
                    key={ex.id}
                    className="py-3 flex items-center justify-between hover:bg-[#FAFAF8] px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#171615] rounded overflow-hidden flex items-center justify-center shrink-0">
                        {ex.mediaType === 'video/mp4' ? (
                          <video src={ex.mediaUrl} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={ex.mediaUrl} alt={ex.name} className="w-full h-full object-contain" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#171615]">{ex.name}</div>
                        <div className="text-[11px] text-[#6E6C67] flex items-center gap-1.5 mt-0.5">
                          <span>{ex.primaryMuscles.join(', ')}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{ex.difficulty}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddExerciseToRoutine(ex)}
                      className="px-3 py-1.5 bg-[#171615] text-white text-xs font-medium rounded hover:bg-[#2A2926] cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Animation Pop-up preview inside routine builder */}
      {previewMediaUrl && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl overflow-hidden max-w-lg w-full relative shadow-2xl">
            <button
              onClick={() => setPreviewMediaUrl(null)}
              className="absolute top-3 right-3 z-10 p-1 bg-white/80 rounded-full text-[#171615] hover:bg-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="bg-[#171615] h-64 flex items-center justify-center p-4">
              {previewMediaUrl.type === 'video/mp4' ? (
                <video src={previewMediaUrl.url} controls autoPlay loop className="max-h-full max-w-full" />
              ) : (
                <img src={previewMediaUrl.url} alt={previewMediaUrl.title} className="max-h-full max-w-full object-contain" />
              )}
            </div>
            <div className="p-4 text-xs font-semibold text-[#171615]">
              {previewMediaUrl.title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
