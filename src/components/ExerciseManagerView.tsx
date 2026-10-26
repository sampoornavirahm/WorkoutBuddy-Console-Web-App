import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Exercise } from '../types';
import {
  getExercises,
  saveExercise,
  deleteExercise,
  seedDefaultCuratedExercises
} from '../services/firestoreService';
import { CURATED_EXERCISES } from '../data/curatedExercises';
import {
  Dumbbell,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
  Info
} from 'lucide-react';

export const ExerciseManagerView: React.FC = () => {
  const { effectiveRole } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Editor Modal State (Admin)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrimaryMuscles, setFormPrimaryMuscles] = useState('');
  const [formSecondaryMuscles, setFormSecondaryMuscles] = useState('');
  const [formEquipment, setFormEquipment] = useState('Bodyweight');
  const [formDifficulty, setFormDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [formInstructions, setFormInstructions] = useState('');
  const [formMediaUrl, setFormMediaUrl] = useState('');
  const [formMediaType, setFormMediaType] = useState<'video/mp4' | 'image/gif' | 'image/svg+xml'>('image/gif');
  const [formPosterUrl, setFormPosterUrl] = useState('');
  const [formDurationSeconds, setFormDurationSeconds] = useState(3);
  const [formLoop, setFormLoop] = useState(true);
  const [formSourceUrl, setFormSourceUrl] = useState('');
  const [formLicenceName, setFormLicenceName] = useState('Creative Commons Attribution-ShareAlike 3.0');
  const [formAttributionText, setFormAttributionText] = useState('');
  const [formStatus, setFormStatus] = useState<'draft' | 'published' | 'archived'>('published');

  // Media Verification Test State
  const [mediaTestStatus, setMediaTestStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [mediaTestMessage, setMediaTestMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getExercises();
      setExercises(data);
    } catch (err) {
      console.error('Failed to load exercises:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormPrimaryMuscles('Quadriceps, Glutes');
    setFormSecondaryMuscles('Core');
    setFormEquipment('Bodyweight');
    setFormDifficulty('beginner');
    setFormInstructions('Stand with feet shoulder-width apart.\nHinge hips and descend smoothly.\nDrive through heels to stand.');
    setFormMediaUrl('https://upload.wikimedia.org/wikipedia/commons/8/82/Squats.gif');
    setFormMediaType('image/gif');
    setFormPosterUrl('');
    setFormDurationSeconds(3);
    setFormLoop(true);
    setFormSourceUrl('https://commons.wikimedia.org/wiki/File:Squats.gif');
    setFormLicenceName('Creative Commons Attribution-ShareAlike 3.0');
    setFormAttributionText('Wikimedia Commons / Maksim');
    setFormStatus('published');
    setMediaTestStatus('idle');
    setIsEditorOpen(true);
  };

  const openEditModal = (ex: Exercise) => {
    setEditingId(ex.id);
    setFormName(ex.name);
    setFormDescription(ex.description || '');
    setFormPrimaryMuscles(ex.primaryMuscles.join(', '));
    setFormSecondaryMuscles(ex.secondaryMuscles ? ex.secondaryMuscles.join(', ') : '');
    setFormEquipment(ex.equipment || 'Bodyweight');
    setFormDifficulty(ex.difficulty);
    setFormInstructions(ex.instructions.join('\n'));
    setFormMediaUrl(ex.mediaUrl);
    setFormMediaType(ex.mediaType);
    setFormPosterUrl(ex.posterUrl || '');
    setFormDurationSeconds(ex.durationSeconds || 3);
    setFormLoop(ex.loop ?? true);
    setFormSourceUrl(ex.sourceUrl || '');
    setFormLicenceName(ex.licenceName || 'Creative Commons');
    setFormAttributionText(ex.attributionText || '');
    setFormStatus(ex.status);
    setMediaTestStatus('idle');
    setIsEditorOpen(true);
  };

  const handlePickCurated = (index: number) => {
    const item = CURATED_EXERCISES[index];
    if (!item) return;
    setFormName(item.name);
    setFormDescription(item.description);
    setFormPrimaryMuscles(item.primaryMuscles.join(', '));
    setFormSecondaryMuscles(item.secondaryMuscles?.join(', ') || '');
    setFormEquipment(item.equipment);
    setFormDifficulty(item.difficulty);
    setFormInstructions(item.instructions.join('\n'));
    setFormMediaUrl(item.mediaUrl);
    setFormMediaType(item.mediaType);
    setFormPosterUrl(item.posterUrl || '');
    setFormDurationSeconds(item.durationSeconds || 3);
    setFormLoop(item.loop ?? true);
    setFormSourceUrl(item.sourceUrl || '');
    setFormLicenceName(item.licenceName || 'Creative Commons');
    setFormAttributionText(item.attributionText || '');
    setMediaTestStatus('valid');
    setMediaTestMessage('Curated open-source asset verified.');
  };

  const testMediaPlayback = () => {
    if (!formMediaUrl.startsWith('https://')) {
      setMediaTestStatus('invalid');
      setMediaTestMessage('Media URL must start with secure https://');
      return;
    }
    setMediaTestStatus('testing');

    if (formMediaType === 'video/mp4') {
      const vid = document.createElement('video');
      vid.src = formMediaUrl;
      vid.onloadedmetadata = () => {
        setMediaTestStatus('valid');
        setMediaTestMessage(`Video stream verified (${Math.round(vid.duration)}s)`);
      };
      vid.onerror = () => {
        setMediaTestStatus('invalid');
        setMediaTestMessage('Failed to load video stream from specified HTTPS URL.');
      };
    } else {
      const img = new Image();
      img.src = formMediaUrl;
      img.onload = () => {
        setMediaTestStatus('valid');
        setMediaTestMessage(`Image/animation asset verified (${img.naturalWidth}x${img.naturalHeight}px)`);
      };
      img.onerror = () => {
        setMediaTestStatus('invalid');
        setMediaTestMessage('Failed to load image/GIF from specified HTTPS URL.');
      };
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!formMediaUrl.startsWith('https://')) {
      setFeedback({ text: 'Media URL must use secure https:// scheme.', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const primaryMuscles = formPrimaryMuscles.split(',').map(m => m.trim()).filter(Boolean);
      const secondaryMuscles = formSecondaryMuscles.split(',').map(m => m.trim()).filter(Boolean);
      const instructions = formInstructions.split('\n').map(s => s.trim()).filter(Boolean);

      await saveExercise({
        id: editingId || undefined,
        name: formName,
        description: formDescription,
        primaryMuscles,
        secondaryMuscles,
        equipment: formEquipment,
        difficulty: formDifficulty,
        instructions,
        mediaUrl: formMediaUrl,
        mediaType: formMediaType,
        posterUrl: formPosterUrl,
        durationSeconds: Number(formDurationSeconds) || 3,
        loop: formLoop,
        sourceUrl: formSourceUrl,
        licenceName: formLicenceName,
        attributionText: formAttributionText,
        status: formStatus,
      });

      setIsEditorOpen(false);
      await loadData();
      setFeedback({ text: `Exercise "${formName}" saved successfully.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to save exercise record.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete exercise "${name}" from the catalogue?`)) return;
    try {
      await deleteExercise(id);
      await loadData();
      setFeedback({ text: `Exercise "${name}" removed.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to delete exercise.',
        type: 'error'
      });
    }
  };

  // Filter exercises
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.primaryMuscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
      ex.equipment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMuscle = selectedMuscle === 'all' || ex.primaryMuscles.includes(selectedMuscle);
    const matchesDiff = selectedDifficulty === 'all' || ex.difficulty === selectedDifficulty;
    return matchesSearch && matchesMuscle && matchesDiff;
  });

  const allMuscles = Array.from(new Set(exercises.flatMap(e => e.primaryMuscles))).sort();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Feedback Alert */}
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
          <h1 className="text-2xl sm:text-3xl font-bold text-[#171615] tracking-tight">
            Exercise Catalogue
          </h1>
          <p className="text-xs text-[#6E6C67] mt-1">
            Curated animation demonstrations, step-by-step instructions, and equipment requirements synced with LG webOS TV.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Exercise</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 border border-[#E6E4DF] rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#9C9A94] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises by name, muscles, equipment..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-transparent border-0 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-[#E6E4DF] pt-2 md:pt-0 md:pl-3">
          <div className="flex items-center gap-1 text-xs text-[#6E6C67]">
            <Filter className="w-3.5 h-3.5" />
            <span>Muscle:</span>
          </div>
          <select
            value={selectedMuscle}
            onChange={(e) => setSelectedMuscle(e.target.value)}
            className="text-xs bg-[#FAFAF8] border border-[#D1CFCA] rounded-md px-2 py-1 text-[#171615] focus:outline-none"
          >
            <option value="all">All Muscles</option>
            {allMuscles.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="text-xs bg-[#FAFAF8] border border-[#D1CFCA] rounded-md px-2 py-1 text-[#171615] focus:outline-none"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Exercise Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-white border border-[#E6E4DF] rounded-xl animate-pulse p-4"></div>
          ))}
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-[#D1CFCA] rounded-xl space-y-3">
          <Dumbbell className="w-8 h-8 text-[#9C9A94] mx-auto" />
          <p className="text-sm font-semibold text-[#171615]">No exercises match your search criteria</p>
          <p className="text-xs text-[#6E6C67]">Try clearing your search query or reset the muscle filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExercises.map((exercise) => (
            <div
              key={exercise.id}
              className="bg-white border border-[#E6E4DF] hover:border-[#D1CFCA] rounded-xl overflow-hidden flex flex-col transition-all hover:shadow-xs group"
            >
              {/* Media Preview Box */}
              <div
                onClick={() => setPreviewExercise(exercise)}
                className="relative h-48 bg-[#171615] flex items-center justify-center overflow-hidden cursor-pointer group/media"
              >
                {exercise.mediaType === 'video/mp4' ? (
                  <video
                    src={exercise.mediaUrl}
                    poster={exercise.posterUrl}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={exercise.mediaUrl}
                    alt={exercise.name}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-3 py-1 bg-white/90 backdrop-blur-xs text-[#171615] text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Inspect Animation</span>
                  </span>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-base text-[#171615] group-hover:text-[#B45309] transition-colors">
                      {exercise.name}
                    </h3>
                    <span className="text-xs text-[#6E6C67] capitalize shrink-0 font-medium">
                      {exercise.difficulty}
                    </span>
                  </div>

                  <p className="text-xs text-[#6E6C67] line-clamp-2 leading-relaxed">
                    {exercise.description}
                  </p>

                  {/* Clean unboxed metadata with bullet separators */}
                  <div className="mt-3 text-xs text-[#6E6C67] flex flex-wrap items-center gap-1.5">
                    <span>{exercise.primaryMuscles.join(', ')}</span>
                    <span aria-hidden="true">·</span>
                    <span>{exercise.equipment}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-numeric">{exercise.durationSeconds}s loop</span>
                  </div>
                </div>

                {/* Footer Attribution & Admin Controls */}
                <div className="pt-3 border-t border-[#F3F1EC] flex items-center justify-between text-xs text-[#9C9A94]">
                  <span className="truncate max-w-[170px]" title={exercise.attributionText || exercise.licenceName}>
                    {exercise.licenceName || 'CC Licensed'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewExercise(exercise)}
                      className="text-xs text-[#171615] hover:text-[#B45309] font-medium cursor-pointer"
                    >
                      View
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => openEditModal(exercise)}
                          className="p-1 text-[#6E6C67] hover:text-[#171615] transition-colors cursor-pointer"
                          title="Edit exercise"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exercise.id, exercise.name)}
                          className="p-1 text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                          title="Delete exercise"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Animation Detail Modal (Pro & Admin) */}
      {previewExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E6E4DF] rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setPreviewExercise(null)}
              className="absolute top-4 right-4 z-10 p-1.5 bg-white/80 hover:bg-white text-[#171615] rounded-full shadow-xs cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video / Animation Preview Stage */}
            <div className="bg-[#171615] h-72 flex items-center justify-center p-4">
              {previewExercise.mediaType === 'video/mp4' ? (
                <video
                  src={previewExercise.mediaUrl}
                  poster={previewExercise.posterUrl}
                  controls
                  autoPlay
                  loop
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <img
                  src={previewExercise.mediaUrl}
                  alt={previewExercise.name}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>

            <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#171615]">{previewExercise.name}</h2>
                  <span className="text-xs font-semibold capitalize text-[#B45309]">
                    {previewExercise.difficulty} level
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6E6C67] mt-1">
                  <span>Target: {previewExercise.primaryMuscles.join(', ')}</span>
                  <span aria-hidden="true">·</span>
                  <span>Equipment: {previewExercise.equipment}</span>
                </div>
              </div>

              <p className="text-sm text-[#171615] leading-relaxed">
                {previewExercise.description}
              </p>

              <div>
                <h4 className="text-xs font-bold text-[#171615] uppercase tracking-wider mb-2">
                  Form & Execution Instructions
                </h4>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-[#6E6C67] leading-relaxed">
                  {previewExercise.instructions.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>

              {/* Attribution and License info */}
              <div className="p-3 bg-[#FAFAF8] border border-[#E6E4DF] rounded-lg text-xs text-[#6E6C67] space-y-1">
                <div className="font-semibold text-[#171615]">Media License & Attribution</div>
                <div>Licence: {previewExercise.licenceName || 'Open Access'}</div>
                {previewExercise.attributionText && (
                  <div>Credit: {previewExercise.attributionText}</div>
                )}
                {previewExercise.sourceUrl && (
                  <a
                    href={previewExercise.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[#B45309] hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>View Upstream Source File</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add/Edit Exercise Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6E4DF] rounded-xl max-w-3xl w-full p-6 sm:p-8 my-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsEditorOpen(false)}
              className="absolute top-5 right-5 text-[#6E6C67] hover:text-[#171615] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#171615]">
                {editingId ? 'Edit Exercise Record' : 'Add Exercise to Catalogue'}
              </h2>
              <p className="text-xs text-[#6E6C67] mt-1">
                Configure exercise biomechanics, verified HTTPS animation URLs, and attribution metadata.
              </p>
            </div>

            {/* Quick Picker from Curated Library */}
            <div className="mb-6 p-4 bg-[#FAFAF8] border border-[#E6E4DF] rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#171615]">
                <Sparkles className="w-4 h-4 text-[#B45309]" />
                <span>Pre-populate from Curated Open-Source Library</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {CURATED_EXERCISES.map((cur, idx) => (
                  <button
                    key={cur.slug}
                    type="button"
                    onClick={() => handlePickCurated(idx)}
                    className="px-2.5 py-1 text-xs bg-white hover:bg-[#F3F1EC] border border-[#D1CFCA] rounded text-[#171615] transition-colors cursor-pointer"
                  >
                    {cur.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Mandatory Cost Constraint Notice */}
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <div>
                <strong>Spark Plan Media Architecture:</strong> Direct binary file uploads to Firebase Storage require the Blaze billing plan. This manager consumes verified HTTPS media URLs (GIFs, MP4s, SVGs) to preserve 100% free-tier operation while maintaining standard schema separation.
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Exercise Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="e.g. Incline Push-Up"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Equipment</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={formEquipment}
                    onChange={(e) => setFormEquipment(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="Bodyweight, Dumbbells, Bench..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#171615] mb-1">Description</label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  placeholder="Comprehensive description of the exercise movement and biomechanics..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Primary Muscles (comma-separated)</label>
                  <input
                    type="text"
                    required
                    value={formPrimaryMuscles}
                    onChange={(e) => setFormPrimaryMuscles(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="Quadriceps, Glutes"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Secondary Muscles (comma-separated)</label>
                  <input
                    type="text"
                    value={formSecondaryMuscles}
                    onChange={(e) => setFormSecondaryMuscles(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="Hamstrings, Core"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Media Format</label>
                  <select
                    value={formMediaType}
                    onChange={(e) => setFormMediaType(e.target.value as 'video/mp4' | 'image/gif' | 'image/svg+xml')}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  >
                    <option value="image/gif">Animated GIF (image/gif)</option>
                    <option value="video/mp4">MP4 Video Clip (video/mp4)</option>
                    <option value="image/svg+xml">Vector Diagram (image/svg+xml)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'draft' | 'published' | 'archived')}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* HTTPS Media URL & Test Tool */}
              <div className="p-4 bg-[#FAFAF8] border border-[#E6E4DF] rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-[#171615]">
                  Animation Media HTTPS URL *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    required
                    pattern="^https://.+"
                    value={formMediaUrl}
                    onChange={(e) => {
                      setFormMediaUrl(e.target.value);
                      setMediaTestStatus('idle');
                    }}
                    placeholder="https://upload.wikimedia.org/.../exercise.gif"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] font-numeric"
                  />
                  <button
                    type="button"
                    onClick={testMediaPlayback}
                    className="px-4 py-2 bg-white hover:bg-[#F3F1EC] border border-[#D1CFCA] text-[#171615] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Test Playback
                  </button>
                </div>

                {mediaTestStatus === 'valid' && (
                  <div className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{mediaTestMessage}</span>
                  </div>
                )}

                {mediaTestStatus === 'invalid' && (
                  <div className="text-xs text-red-700 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    <span>{mediaTestMessage}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#171615] mb-1">Step-by-Step Instructions (one per line)</label>
                <textarea
                  rows={3}
                  required
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  placeholder="Step 1: Set starting position&#10;Step 2: Engage core and initiate descent&#10;Step 3: Explode up to completion"
                />
              </div>

              {/* Attribution & Licensing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Licence Name</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={formLicenceName}
                    onChange={(e) => setFormLicenceName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="e.g. Creative Commons BY-SA 4.0, Public Domain"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Attribution Credit</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={formAttributionText}
                    onChange={(e) => setFormAttributionText(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="e.g. Wikimedia Commons / Author Name"
                  />
                </div>
              </div>

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
                  disabled={saving}
                  className="px-5 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Exercise Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
