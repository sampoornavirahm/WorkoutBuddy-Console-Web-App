import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Exercise } from '../types';
import {
  getExercises,
  saveExercise,
  deleteExercise,
  syncExercisesToFirestore
} from '../services/firestoreService';
import {
  ALL_DATASET_EXERCISES,
  CURATED_EXERCISES
} from '../data/curatedExercises';
import { ExerciseAnimationStage } from './ExerciseAnimationStage';
import {
  subscribeExerciseFlags,
  setExerciseGifFlag,
  isExerciseGifWrong,
  getExerciseFlag,
  ExerciseVerificationFlag
} from '../services/exerciseVerificationService';
import {
  Dumbbell,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Play,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Check,
  X,
  Sparkles,
  Info,
  CloudUpload,
  RefreshCw,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Ban
} from 'lucide-react';

interface ExerciseManagerViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const ExerciseManagerView: React.FC<ExerciseManagerViewProps> = ({ onNavigateTab }) => {
  const { currentUser, effectiveRole } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  const [exercises, setExercises] = useState<Exercise[]>(ALL_DATASET_EXERCISES);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'verified' | 'wrong' | 'unreviewed'>('all');
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Verification Flags Store
  const [flags, setFlags] = useState<Record<string, ExerciseVerificationFlag>>({});
  const [reviewNoteInput, setReviewNoteInput] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const catalogTopRef = useRef<HTMLDivElement>(null);

  // Subscribe to live exercise verification flags
  useEffect(() => {
    const unsub = subscribeExerciseFlags((updatedFlags) => {
      setFlags(updatedFlags);
    });
    return unsub;
  }, []);

  // Sync Progress State (Admin)
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ synced: number; total: number } | null>(null);

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
  const [formLicenceName, setFormLicenceName] = useState('Gym visual / Free for personal use');
  const [formAttributionText, setFormAttributionText] = useState('© Gym visual — https://gymvisual.com/');
  const [formStatus, setFormStatus] = useState<'draft' | 'published' | 'archived'>('published');

  // Media Verification Test State
  const [mediaTestStatus, setMediaTestStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [mediaTestMessage, setMediaTestMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
    setJumpPageInput('');
  }, [searchQuery, selectedMuscle, selectedEquipment, selectedDifficulty, selectedStatusFilter, pageSize]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getExercises();
      setExercises(data);
    } catch (err) {
      console.warn('Falling back to bundled dataset:', err);
      setExercises(ALL_DATASET_EXERCISES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartCloudSync = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Sync the full 1,324 exercise animation catalog to Cloud Firestore? This runs in batches of 40.')) {
      return;
    }
    try {
      setIsSyncing(true);
      setSyncProgress({ synced: 0, total: ALL_DATASET_EXERCISES.length });
      const totalSynced = await syncExercisesToFirestore((synced, total) => {
        setSyncProgress({ synced, total });
      });
      setFeedback({
        text: `Successfully synchronized ${totalSynced} exercises with Cloud Firestore.`,
        type: 'success',
      });
      await loadData();
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Cloud Firestore synchronization failed.',
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedMuscle('all');
    setSelectedEquipment('all');
    setSelectedDifficulty('all');
    setSelectedStatusFilter('all');
    setCurrentPage(1);
    setJumpPageInput('');
  };

  const handleToggleVerification = async (exercise: Exercise, isWrong: boolean, reason?: string) => {
    try {
      await setExerciseGifFlag(
        exercise.id,
        isWrong,
        reason || '',
        currentUser?.uid,
        currentUser?.email || undefined
      );
      setFeedback({
        text: isWrong
          ? `Flagged "${exercise.name}" GIF as incorrect. It is now disabled from routine builders.`
          : `Marked "${exercise.name}" GIF as verified correct.`,
        type: 'success'
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to update GIF verification.',
        type: 'error'
      });
    }
  };

  const hasActiveFilters = searchQuery !== '' ||
    selectedMuscle !== 'all' ||
    selectedEquipment !== 'all' ||
    selectedDifficulty !== 'all' ||
    selectedStatusFilter !== 'all';

  const wrongCount = useMemo(() => {
    return exercises.filter(e => isExerciseGifWrong(e.id)).length;
  }, [exercises, flags]);

  const verifiedCount = useMemo(() => {
    return exercises.filter(e => flags[e.id]?.status === 'correct').length;
  }, [exercises, flags]);

  const unreviewedCount = useMemo(() => {
    return Math.max(0, exercises.length - wrongCount - verifiedCount);
  }, [exercises.length, wrongCount, verifiedCount]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormPrimaryMuscles('Quadriceps, Glutes');
    setFormSecondaryMuscles('Core');
    setFormEquipment('Bodyweight');
    setFormDifficulty('beginner');
    setFormInstructions('Stand with feet shoulder-width apart.\nHinge hips and descend smoothly until thighs are parallel.\nDrive through heels to stand upright.');
    setFormMediaUrl('https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/0662-I4hDWkc.gif');
    setFormMediaType('image/gif');
    setFormPosterUrl('https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/images/0662-I4hDWkc.jpg');
    setFormDurationSeconds(3);
    setFormLoop(true);
    setFormSourceUrl('https://github.com/hasaneyldrm/exercises-dataset');
    setFormLicenceName('Gym visual / Free for personal use');
    setFormAttributionText('© Gym visual — https://gymvisual.com/');
    setFormStatus('published');
    setMediaTestStatus('idle');
    setMediaTestMessage('');
    setIsEditorOpen(true);
  };

  const openEditModal = (ex: Exercise) => {
    setEditingId(ex.id);
    setFormName(ex.name);
    setFormDescription(ex.description || '');
    setFormPrimaryMuscles((ex.primaryMuscles || []).join(', '));
    setFormSecondaryMuscles((ex.secondaryMuscles || []).join(', '));
    setFormEquipment(ex.equipment || 'Bodyweight');
    setFormDifficulty(ex.difficulty || 'beginner');
    setFormInstructions((ex.instructions || []).join('\n'));
    setFormMediaUrl(ex.mediaUrl);
    setFormMediaType(ex.mediaType || 'image/gif');
    setFormPosterUrl(ex.posterUrl || '');
    setFormDurationSeconds(ex.durationSeconds ?? 3);
    setFormLoop(ex.loop ?? true);
    setFormSourceUrl(ex.sourceUrl || '');
    setFormLicenceName(ex.licenceName || 'Gym visual / Free for personal use');
    setFormAttributionText(ex.attributionText || '© Gym visual — https://gymvisual.com/');
    setFormStatus(ex.status || 'published');
    setMediaTestStatus('idle');
    setMediaTestMessage('');
    setIsEditorOpen(true);
  };

  const handlePickCurated = (index: number) => {
    const cur = CURATED_EXERCISES[index];
    if (!cur) return;
    setFormName(cur.name);
    setFormDescription(cur.description || '');
    setFormPrimaryMuscles((cur.primaryMuscles || []).join(', '));
    setFormSecondaryMuscles((cur.secondaryMuscles || []).join(', '));
    setFormEquipment(cur.equipment || 'Bodyweight');
    setFormDifficulty(cur.difficulty || 'beginner');
    setFormInstructions((cur.instructions || []).join('\n'));
    setFormMediaUrl(cur.mediaUrl);
    setFormMediaType(cur.mediaType || 'image/gif');
    setFormPosterUrl(cur.posterUrl || '');
    setFormDurationSeconds(cur.durationSeconds ?? 3);
    setFormLoop(cur.loop ?? true);
    setFormSourceUrl(cur.sourceUrl || '');
    setFormLicenceName(cur.licenceName || 'Gym visual / Free for personal use');
    setFormAttributionText(cur.attributionText || '© Gym visual — https://gymvisual.com/');
    setMediaTestStatus('idle');
    setMediaTestMessage('');
  };

  const handleTestMedia = () => {
    if (!formMediaUrl.startsWith('https://')) {
      setMediaTestStatus('invalid');
      setMediaTestMessage('Media URL must begin with secure https://');
      return;
    }

    setMediaTestStatus('testing');
    setMediaTestMessage('Validating remote playback stream...');

    if (formMediaType === 'video/mp4') {
      const v = document.createElement('video');
      v.src = formMediaUrl;
      v.onloadedmetadata = () => {
        setMediaTestStatus('valid');
        setMediaTestMessage(`Video valid (${v.videoWidth}x${v.videoHeight}, ${v.duration.toFixed(1)}s duration)`);
      };
      v.onerror = () => {
        setMediaTestStatus('invalid');
        setMediaTestMessage('Failed to load MP4 video. Please check CORS or link validity.');
      };
    } else {
      const img = new Image();
      img.src = formMediaUrl;
      img.onload = () => {
        setMediaTestStatus('valid');
        setMediaTestMessage(`Animation valid (${img.naturalWidth}x${img.naturalHeight}px)`);
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

  // High-performance filtering with useMemo
  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return exercises.filter(ex => {
      // 1. Text search
      if (query) {
        const matchName = ex.name.toLowerCase().includes(query);
        const matchMuscle = ex.primaryMuscles?.some(m => m.toLowerCase().includes(query));
        const matchEquipment = ex.equipment?.toLowerCase().includes(query);
        const matchSecondary = ex.secondaryMuscles?.some(m => m.toLowerCase().includes(query));
        if (!matchName && !matchMuscle && !matchEquipment && !matchSecondary) {
          return false;
        }
      }

      // 2. Muscle target
      if (selectedMuscle !== 'all') {
        const hasMuscle = ex.primaryMuscles?.some(m => m.toLowerCase() === selectedMuscle.toLowerCase()) ||
          ex.secondaryMuscles?.some(m => m.toLowerCase() === selectedMuscle.toLowerCase());
        if (!hasMuscle) return false;
      }

      // 3. Equipment
      if (selectedEquipment !== 'all') {
        if (ex.equipment?.toLowerCase() !== selectedEquipment.toLowerCase()) {
          return false;
        }
      }

      // 4. Difficulty
      if (selectedDifficulty !== 'all') {
        if (ex.difficulty?.toLowerCase() !== selectedDifficulty.toLowerCase()) {
          return false;
        }
      }

      // 5. Verification status filter
      if (selectedStatusFilter === 'wrong') {
        if (!isExerciseGifWrong(ex.id)) return false;
      } else if (selectedStatusFilter === 'verified') {
        if (flags[ex.id]?.status !== 'correct') return false;
      } else if (selectedStatusFilter === 'unreviewed') {
        if (flags[ex.id] !== undefined) return false;
      }

      return true;
    });
  }, [exercises, searchQuery, selectedMuscle, selectedEquipment, selectedDifficulty, selectedStatusFilter, flags]);

  // Pagination metrics
  const totalPages = Math.max(1, Math.ceil(filteredExercises.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredExercises.length);

  const displayedExercises = useMemo(() => {
    return filteredExercises.slice(startIndex, endIndex);
  }, [filteredExercises, startIndex, endIndex]);

  const handlePageChange = (newPage: number) => {
    const target = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(target);
    setJumpPageInput('');
    catalogTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      handlePageChange(parsed);
    }
  };

  const pageNumbers = useMemo(() => {
    const list: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) list.push(i);
    } else {
      list.push(1);
      if (safeCurrentPage > 3) list.push('ellipsis-start');
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) list.push(i);
      if (safeCurrentPage < totalPages - 2) list.push('ellipsis-end');
      list.push(totalPages);
    }
    return list;
  }, [safeCurrentPage, totalPages]);

  // Dynamic distinct lists from current exercises state
  const distinctMuscles = useMemo(() => {
    return Array.from(new Set(exercises.flatMap(e => e.primaryMuscles || []))).sort();
  }, [exercises]);

  const distinctEquipment = useMemo(() => {
    return Array.from(new Set(exercises.map(e => e.equipment).filter(Boolean))).sort();
  }, [exercises]);

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#171615] tracking-tight">
              Exercise Catalogue
            </h1>
            <span className="text-xs font-mono tabular-nums px-2 py-0.5 bg-[#F3F1EC] text-[#6E6C67] rounded-md font-semibold">
              1,324 Animations
            </span>
          </div>
          <p className="text-xs text-[#6E6C67] mt-1">
            Complete database of 1,324 biomechanical animated workouts from open-source repository. Filter by muscle, equipment, or difficulty.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isAdmin && (
            <>
              <button
                onClick={handleStartCloudSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#F3F1EC] border border-[#D1CFCA] text-[#171615] text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs disabled:opacity-50"
                title="Sync all 1,324 exercises to Firebase Firestore"
              >
                <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce text-[#B45309]' : 'text-[#6E6C67]'}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync to Firestore'}</span>
              </button>

              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sync Modal / Floating Progress */}
      {isSyncing && syncProgress && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#B45309]" />
              Syncing Exercises to Cloud Firestore (Batches of 40)
            </span>
            <span className="font-mono tabular-nums">
              {syncProgress.synced} / {syncProgress.total} ({Math.round((syncProgress.synced / syncProgress.total) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-amber-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#B45309] h-1.5 transition-all duration-150"
              style={{ width: `${(syncProgress.synced / syncProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Verification Review & Status Tabs */}
      <div ref={catalogTopRef} className="flex flex-wrap items-center gap-2 border-b border-[#E6E4DF] pb-3 text-xs">
        <span className="text-[#6E6C67] font-medium mr-1">Filter by Status:</span>
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
            selectedStatusFilter === 'all'
              ? 'bg-[#171615] text-white'
              : 'bg-white text-[#6E6C67] hover:text-[#171615] border border-[#E6E4DF]'
          }`}
        >
          All Exercises ({exercises.length.toLocaleString()})
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('verified')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            selectedStatusFilter === 'verified'
              ? 'bg-emerald-700 text-white'
              : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Verified Correct ({verifiedCount.toLocaleString()})</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('wrong')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            selectedStatusFilter === 'wrong'
              ? 'bg-red-700 text-white'
              : 'bg-white text-red-800 hover:bg-red-50 border border-red-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>⚠️ Flagged Wrong / Disabled ({wrongCount.toLocaleString()})</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatusFilter('unreviewed')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
            selectedStatusFilter === 'unreviewed'
              ? 'bg-[#6E6C67] text-white'
              : 'bg-white text-[#6E6C67] hover:text-[#171615] border border-[#E6E4DF]'
          }`}
        >
          Unreviewed ({unreviewedCount.toLocaleString()})
        </button>
      </div>

      {/* Multi-Facet Filter Bar */}
      <div className="bg-white p-4 border border-[#E6E4DF] rounded-xl space-y-3">
        {/* Search Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9C9A94] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 1,324 exercises by name, targeted muscle, equipment..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#FAFAF8] border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] text-[#171615]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-[#9C9A94] hover:text-[#171615] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Muscle Filter */}
            <div className="flex items-center gap-1.5 bg-[#FAFAF8] border border-[#D1CFCA] rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-[#6E6C67] uppercase tracking-wider">Muscle:</span>
              <select
                value={selectedMuscle}
                onChange={(e) => setSelectedMuscle(e.target.value)}
                className="text-xs bg-transparent text-[#171615] font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Muscles ({distinctMuscles.length})</option>
                {distinctMuscles.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Equipment Filter */}
            <div className="flex items-center gap-1.5 bg-[#FAFAF8] border border-[#D1CFCA] rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-[#6E6C67] uppercase tracking-wider">Equipment:</span>
              <select
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value)}
                className="text-xs bg-transparent text-[#171615] font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Equipment ({distinctEquipment.length})</option>
                {distinctEquipment.map(eq => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center gap-1.5 bg-[#FAFAF8] border border-[#D1CFCA] rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-[#6E6C67] uppercase tracking-wider">Level:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="text-xs bg-transparent text-[#171615] font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 bg-[#FAFAF8] border border-[#D1CFCA] rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-medium text-[#6E6C67] uppercase tracking-wider">Per Page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs bg-transparent text-[#171615] font-medium focus:outline-none cursor-pointer"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={36}>36</option>
                <option value={48}>48</option>
                <option value={96}>96</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#B45309] hover:bg-amber-50 rounded-lg transition-colors cursor-pointer font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#6E6C67] pt-2 border-t border-[#F3F1EC]">
          <div>
            Showing <strong className="text-[#171615] font-mono tabular-nums">{filteredExercises.length > 0 ? startIndex + 1 : 0}–{endIndex}</strong> of{' '}
            <strong className="text-[#171615] font-mono tabular-nums">{filteredExercises.length.toLocaleString()}</strong> exercises
            {filteredExercises.length !== exercises.length && (
              <span className="text-[#9C9A94]"> (filtered from {exercises.length.toLocaleString()} total)</span>
            )}
          </div>
          <div className="font-mono text-[11px] text-[#6E6C67]">
            Page {safeCurrentPage} of {totalPages}
          </div>
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
          <p className="text-sm font-semibold text-[#171615]">No exercises match your filter criteria</p>
          <p className="text-xs text-[#6E6C67]">Try clearing your search query or reset the muscle/equipment filters.</p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-1.5 text-xs font-semibold bg-[#171615] text-white rounded-lg hover:bg-[#2A2926] cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedExercises.map((exercise) => {
            const isWrong = isExerciseGifWrong(exercise.id);
            const flag = flags[exercise.id];

            return (
              <div
                key={exercise.id}
                className={`bg-white border rounded-xl overflow-hidden flex flex-col transition-all hover:shadow-xs group ${
                  isWrong
                    ? 'border-red-300 bg-red-50/15'
                    : 'border-[#E6E4DF] hover:border-[#D1CFCA]'
                }`}
              >
                {/* Media Preview Box with Clean Flat White Stage (No Shadow / Shade) */}
                <ExerciseAnimationStage
                  mediaUrl={exercise.mediaUrl}
                  posterUrl={exercise.posterUrl}
                  mediaType={exercise.mediaType}
                  name={exercise.name}
                  size="card"
                  interactive
                  onInspect={() => {
                    setPreviewExercise(exercise);
                    setReviewNoteInput(flag?.reason || '');
                  }}
                />

                {/* Content Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3.5">
                  <div>
                    {/* Status Badge */}
                    <div className="mb-2 flex items-center justify-between gap-1.5">
                      {isWrong ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                          <span>Wrong GIF · Disabled</span>
                        </span>
                      ) : flag?.status === 'correct' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Verified Correct GIF</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[#6E6C67] bg-[#FAFAF8] border border-[#E6E4DF]">
                          Unreviewed
                        </span>
                      )}

                      <span className="text-[11px] text-[#6E6C67] capitalize shrink-0 font-medium font-mono">
                        {exercise.difficulty}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        onClick={() => {
                          setPreviewExercise(exercise);
                          setReviewNoteInput(flag?.reason || '');
                        }}
                        className={`font-bold text-sm transition-colors cursor-pointer ${
                          isWrong ? 'text-red-950 line-through' : 'text-[#171615] group-hover:text-[#B45309]'
                        }`}
                        title={isWrong ? 'Animation flagged as incorrect' : exercise.name}
                      >
                        {exercise.name}
                      </h3>
                    </div>

                    <p className="text-xs text-[#6E6C67] line-clamp-2 leading-relaxed">
                      {exercise.description}
                    </p>

                    {/* Clean unboxed metadata with bullet separators */}
                    <div className="mt-2.5 text-xs text-[#6E6C67] flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-[#171615]">{exercise.primaryMuscles.join(', ')}</span>
                      <span aria-hidden="true">·</span>
                      <span>{exercise.equipment}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{exercise.durationSeconds}s loop</span>
                    </div>
                  </div>

                  {/* GIF Accuracy Right / Wrong Feedback Row */}
                  <div className="pt-2.5 border-t border-[#F3F1EC] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#6E6C67]">
                      GIF Accuracy:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleVerification(exercise, false)}
                        title="Mark as correct animation"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                          flag?.status === 'correct'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold shadow-xs'
                            : 'bg-white hover:bg-emerald-50 text-[#6E6C67] hover:text-emerald-700 border border-[#D1CFCA]'
                        }`}
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Right</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleVerification(exercise, true)}
                        title="Mark as wrong animation (disables exercise from routines)"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                          isWrong
                            ? 'bg-red-100 text-red-800 border border-red-300 font-semibold shadow-xs'
                            : 'bg-white hover:bg-red-50 text-[#6E6C67] hover:text-red-700 border border-[#D1CFCA]'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        <span>Wrong</span>
                      </button>
                    </div>
                  </div>

                  {/* Footer Attribution & Actions */}
                  <div className="pt-2 border-t border-[#F3F1EC] flex items-center justify-between text-xs text-[#9C9A94]">
                    <span className="truncate max-w-[150px]" title={exercise.attributionText || exercise.licenceName}>
                      {exercise.licenceName || 'Gym visual / CC'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPreviewExercise(exercise);
                          setReviewNoteInput(flag?.reason || '');
                        }}
                        className="text-xs text-[#171615] hover:text-[#B45309] font-medium cursor-pointer"
                      >
                        Inspect
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
            );
          })}
        </div>
      )}

      {/* Structured Pagination Controls Toolbar */}
      {filteredExercises.length > 0 && totalPages > 1 && (
        <div className="bg-white border border-[#E6E4DF] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
          {/* Summary / Range */}
          <div className="text-xs text-[#6E6C67]">
            Showing <strong className="text-[#171615] font-mono tabular-nums">{startIndex + 1}–{endIndex}</strong> of{' '}
            <strong className="text-[#171615] font-mono tabular-nums">{filteredExercises.length.toLocaleString()}</strong> exercises · Page{' '}
            <strong className="text-[#171615] font-mono tabular-nums">{safeCurrentPage}</strong> of{' '}
            <strong className="text-[#171615] font-mono tabular-nums">{totalPages}</strong>
          </div>

          {/* Page Buttons with Smart Ellipsis */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {/* First Page */}
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={safeCurrentPage === 1}
              className="p-1.5 rounded-lg border border-[#D1CFCA] bg-white hover:bg-[#F3F1EC] text-[#171615] disabled:opacity-30 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Prev Page */}
            <button
              type="button"
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D1CFCA] bg-white hover:bg-[#F3F1EC] text-xs font-medium text-[#171615] disabled:opacity-30 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {/* Numeric Page Buttons */}
            {pageNumbers.map((p, idx) => {
              if (p === 'ellipsis-start' || p === 'ellipsis-end') {
                return (
                  <span key={`${p}-${idx}`} className="px-2 py-1 text-xs text-[#9C9A94] font-mono">
                    …
                  </span>
                );
              }

              const pageNum = Number(p);
              const isActive = pageNum === safeCurrentPage;

              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => handlePageChange(pageNum)}
                  className={`min-w-8 h-8 px-2 text-xs font-mono font-semibold rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#171615] text-white shadow-xs'
                      : 'bg-white hover:bg-[#F3F1EC] text-[#171615] border border-[#D1CFCA]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Page */}
            <button
              type="button"
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D1CFCA] bg-white hover:bg-[#F3F1EC] text-xs font-medium text-[#171615] disabled:opacity-30 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="p-1.5 rounded-lg border border-[#D1CFCA] bg-white hover:bg-[#F3F1EC] text-[#171615] disabled:opacity-30 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Jump to Page Form */}
          <form onSubmit={handleJumpPage} className="flex items-center gap-1.5 text-xs text-[#6E6C67]">
            <span>Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(safeCurrentPage)}
              className="w-14 px-2 py-1 bg-[#FAFAF8] border border-[#D1CFCA] rounded font-mono text-xs text-[#171615] text-center focus:outline-none focus:border-[#171615]"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-[#171615] hover:bg-[#2A2926] text-white text-xs font-semibold rounded transition-colors cursor-pointer"
            >
              Go
            </button>
          </form>
        </div>
      )}

      {/* Animation Detail Modal */}
      {previewExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E6E4DF] rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setPreviewExercise(null)}
              className="absolute top-4 right-4 z-10 p-1.5 bg-white/90 hover:bg-white text-[#171615] rounded-full shadow-xs cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video / Animation Preview Stage with Clean Flat White Stage (No Shadow / Shade) */}
            <ExerciseAnimationStage
              mediaUrl={previewExercise.mediaUrl}
              posterUrl={previewExercise.posterUrl}
              mediaType={previewExercise.mediaType}
              name={previewExercise.name}
              size="modal"
            />

            <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
              {/* GIF Flagged Warning Banner */}
              {(() => {
                const isModalWrong = isExerciseGifWrong(previewExercise.id);
                const modalFlag = flags[previewExercise.id];

                return isModalWrong ? (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold text-red-950">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Animation Flagged as Incorrect · Disabled from Routines</span>
                    </div>
                    <p className="text-red-800 leading-relaxed">
                      This exercise animation has been flagged as wrong or inaccurate. Until a corrected animation is found and updated, this exercise cannot be added to routines.
                    </p>
                    {modalFlag?.reason && (
                      <p className="text-[11px] text-red-700 italic font-medium">
                        Reporter note: &ldquo;{modalFlag.reason}&rdquo;
                      </p>
                    )}
                  </div>
                ) : modalFlag?.status === 'correct' ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>This animation has been reviewed and verified as correct.</span>
                  </div>
                ) : null;
              })()}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-[#171615]">{previewExercise.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-[#6E6C67] mt-1">
                    <span>Target: <strong>{previewExercise.primaryMuscles.join(', ')}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span>Equipment: <strong>{previewExercise.equipment}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{previewExercise.difficulty} level</span>
                  </div>
                </div>

                {onNavigateTab && (() => {
                  const isModalWrong = isExerciseGifWrong(previewExercise.id);
                  return (
                    <button
                      onClick={() => {
                        if (isModalWrong) return;
                        setPreviewExercise(null);
                        onNavigateTab('routines');
                      }}
                      disabled={isModalWrong}
                      title={
                        isModalWrong
                          ? 'Cannot create routine: this exercise has been flagged as having an incorrect GIF.'
                          : 'Create Routine with this exercise'
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg self-start sm:self-auto shrink-0 shadow-xs transition-colors ${
                        isModalWrong
                          ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed border border-neutral-300'
                          : 'bg-[#171615] text-white hover:bg-[#2A2926] cursor-pointer'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isModalWrong ? 'Disabled from Routines' : 'Create Routine'}</span>
                    </button>
                  );
                })()}
              </div>

              {/* GIF Accuracy Right / Wrong Feedback Panel */}
              {(() => {
                const isModalWrong = isExerciseGifWrong(previewExercise.id);
                const modalFlag = flags[previewExercise.id];

                return (
                  <div className="p-3.5 bg-[#FAFAF8] border border-[#E6E4DF] rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#171615]">Is this exercise GIF accurate?</span>
                      <span className="text-[11px] text-[#6E6C67]">
                        Flagging wrong disables it from routines until fixed
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleVerification(previewExercise, false, reviewNoteInput)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          modalFlag?.status === 'correct'
                            ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>✓ Right / Correct GIF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleVerification(previewExercise, true, reviewNoteInput)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          isModalWrong
                            ? 'bg-red-700 text-white shadow-xs font-semibold'
                            : 'bg-white hover:bg-red-50 text-red-800 border border-red-300'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>✕ Wrong GIF (Disable from Routines)</span>
                      </button>
                    </div>

                    <div className="pt-0.5">
                      <input
                        type="text"
                        value={reviewNoteInput}
                        onChange={(e) => setReviewNoteInput(e.target.value)}
                        placeholder="Optional feedback note (e.g. wrong muscle highlighted, reversed movement, different exercise)"
                        className="w-full px-2.5 py-1.5 bg-white border border-[#D1CFCA] rounded-lg text-xs text-[#171615] placeholder-[#9C9A94] focus:outline-none focus:border-[#171615]"
                      />
                    </div>
                  </div>
                );
              })()}

              {previewExercise.secondaryMuscles && previewExercise.secondaryMuscles.length > 0 && (
                <div className="text-xs text-[#6E6C67]">
                  <span>Secondary Muscles: </span>
                  <span className="font-medium text-[#171615]">{previewExercise.secondaryMuscles.join(', ')}</span>
                </div>
              )}

              <p className="text-xs text-[#171615] leading-relaxed">
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
                <div className="font-semibold text-[#171615]">Media License & Provenance</div>
                <div>Licence: {previewExercise.licenceName || 'Open Access'}</div>
                {previewExercise.attributionText && (
                  <div>Attribution: {previewExercise.attributionText}</div>
                )}
                {previewExercise.sourceUrl && (
                  <a
                    href={previewExercise.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[#B45309] hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>View upstream GitHub repository (hasaneyldrm/exercises-dataset)</span>
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
                {editingId ? 'Edit Exercise Record' : 'Add Custom Exercise'}
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
                {CURATED_EXERCISES.slice(0, 16).map((cur, idx) => (
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
                    placeholder="e.g. Incline Dumbbell Press"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Equipment</label>
                  <input
                    type="text"
                    value={formEquipment}
                    onChange={(e) => setFormEquipment(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="e.g. Dumbbell, Barbell, Body Weight"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#171615] mb-1">Description / Cues</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  placeholder="Key cues, biomechanical setup, and breathing tips..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Primary Muscles (comma-separated)</label>
                  <input
                    type="text"
                    required
                    value={formPrimaryMuscles}
                    onChange={(e) => setFormPrimaryMuscles(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="Chest, Anterior Deltoids"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Secondary Muscles</label>
                  <input
                    type="text"
                    value={formSecondaryMuscles}
                    onChange={(e) => setFormSecondaryMuscles(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="Triceps, Core"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Difficulty</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Media URL configuration */}
              <div className="p-4 bg-[#FAFAF8] border border-[#E6E4DF] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#171615]">HTTPS Media URL (GIF / MP4) *</label>
                  <button
                    type="button"
                    onClick={handleTestMedia}
                    className="text-xs text-[#B45309] hover:underline font-semibold cursor-pointer"
                  >
                    Validate Media Playback
                  </button>
                </div>
                <input
                  type="url"
                  required
                  value={formMediaUrl}
                  onChange={(e) => setFormMediaUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615] font-mono text-xs"
                  placeholder="https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/..."
                />

                {mediaTestStatus !== 'idle' && (
                  <div
                    className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                      mediaTestStatus === 'valid'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : mediaTestStatus === 'invalid'
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-neutral-100 text-[#6E6C67]'
                    }`}
                  >
                    {mediaTestStatus === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {mediaTestStatus === 'invalid' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#171615] mb-1">Licence Name</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={formLicenceName}
                    onChange={(e) => setFormLicenceName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D1CFCA] rounded-lg focus:outline-none focus:border-[#171615]"
                    placeholder="e.g. Gym visual / Free for personal use"
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
                    placeholder="e.g. © Gym visual — https://gymvisual.com/"
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
