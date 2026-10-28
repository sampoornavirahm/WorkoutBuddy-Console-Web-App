import { Exercise } from '../types';
import rawDataset from './exercisesDataset.json';

const BASE_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function resolveExerciseMedia(exercise: Partial<Exercise> | null | undefined): {
  mediaUrl: string;
  posterUrl: string;
  mediaType: 'image/gif' | 'video/mp4' | 'image/svg+xml';
} {
  const name = (exercise?.name || '').toLowerCase();
  let mediaUrl = (exercise?.mediaUrl || '').trim();
  let posterUrl = (exercise?.posterUrl || '').trim();
  let mediaType = (exercise?.mediaType as any) || 'image/gif';

  // If Wikimedia or missing or known broken 404 URL, automatically heal to verified dataset animation
  if (!mediaUrl || mediaUrl.includes('upload.wikimedia.org') || mediaUrl.includes('wikimedia') || mediaUrl.endsWith('/Squats.gif')) {
    if (name.includes('squat')) {
      mediaUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/2368-9E25EOx.gif';
      posterUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/images/2368-9E25EOx.jpg';
    } else if (name.includes('push-up') || name.includes('push up') || name.includes('liegestuetz')) {
      mediaUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/0662-I4hDWkc.gif';
      posterUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/images/0662-I4hDWkc.jpg';
    } else if (name.includes('plank')) {
      mediaUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/0464-CosupLu.gif';
      posterUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/images/0464-CosupLu.jpg';
    } else {
      mediaUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/0662-I4hDWkc.gif';
      posterUrl = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/images/0662-I4hDWkc.jpg';
    }
    mediaType = 'image/gif';
  }

  // Derive poster from jsdelivr if missing
  if (!posterUrl && mediaUrl.includes('cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/')) {
    posterUrl = mediaUrl.replace('/videos/', '/images/').replace(/\.gif$/, '.jpg');
  }

  // Deduce mediaType from file extension if mismatched
  if (mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm')) {
    mediaType = 'video/mp4';
  } else if (mediaUrl.endsWith('.gif') || mediaUrl.endsWith('.jpg') || mediaUrl.endsWith('.png') || mediaUrl.endsWith('.jpeg')) {
    mediaType = 'image/gif';
  }

  return { mediaUrl, posterUrl, mediaType };
}

// Full 1,324 exercise dataset from hasaneyldrm/exercises-dataset
export const ALL_DATASET_EXERCISES: Exercise[] = (rawDataset as any[]).map((item, idx) => {
  const resolved = resolveExerciseMedia(item);
  return {
    id: item.id || `ex_${String(idx + 1).padStart(4, '0')}`,
    name: item.name,
    slug: item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: item.description || '',
    primaryMuscles: Array.isArray(item.primaryMuscles) && item.primaryMuscles.length > 0 ? item.primaryMuscles : ['Full Body'],
    secondaryMuscles: Array.isArray(item.secondaryMuscles) ? item.secondaryMuscles : [],
    equipment: item.equipment || 'Body Weight',
    difficulty: (item.difficulty as 'beginner' | 'intermediate' | 'advanced') || 'beginner',
    instructions: Array.isArray(item.instructions) ? item.instructions : [],
    mediaUrl: resolved.mediaUrl,
    mediaType: resolved.mediaType,
    posterUrl: resolved.posterUrl,
    durationSeconds: Number(item.durationSeconds) || 3,
    loop: item.loop ?? true,
    sourceUrl: item.sourceUrl || 'https://github.com/hasaneyldrm/exercises-dataset',
    licenceName: item.licenceName || 'Gym visual / Free for personal use',
    attributionText: item.attributionText || '© Gym visual — https://gymvisual.com/',
    status: 'published',
    createdAt: item.createdAt || BASE_TIMESTAMP,
    updatedAt: item.updatedAt || BASE_TIMESTAMP,
    createdBy: item.createdBy || 'exercises-dataset',
  };
});

// Quick curated subset (first 60 exercises for fast previews)
export const CURATED_EXERCISES: Exercise[] = ALL_DATASET_EXERCISES.slice(0, 60);

// Distinct primary muscle groups across all 1,324 exercises
export const ALL_MUSCLE_GROUPS: string[] = Array.from(
  new Set(ALL_DATASET_EXERCISES.flatMap(e => e.primaryMuscles || []))
).sort();

// Distinct equipment categories across all 1,324 exercises
export const ALL_EQUIPMENT_TYPES: string[] = Array.from(
  new Set(ALL_DATASET_EXERCISES.map(e => e.equipment).filter(Boolean))
).sort();

// High-performance multi-facet filter function
export function filterExercisesDataset(
  dataset: Exercise[],
  searchQuery: string,
  selectedMuscle: string,
  selectedEquipment: string,
  selectedDifficulty: string
): Exercise[] {
  const query = searchQuery.trim().toLowerCase();

  return dataset.filter(ex => {
    // Search query matching against name, muscle, equipment, or instructions
    if (query) {
      const matchName = ex.name.toLowerCase().includes(query);
      const matchMuscle = ex.primaryMuscles?.some(m => m.toLowerCase().includes(query));
      const matchEquipment = ex.equipment?.toLowerCase().includes(query);
      const matchSecondary = ex.secondaryMuscles?.some(m => m.toLowerCase().includes(query));
      if (!matchName && !matchMuscle && !matchEquipment && !matchSecondary) {
        return false;
      }
    }

    // Muscle facet filter
    if (selectedMuscle !== 'all') {
      const hasMuscle = ex.primaryMuscles?.some(m => m.toLowerCase() === selectedMuscle.toLowerCase()) ||
        ex.secondaryMuscles?.some(m => m.toLowerCase() === selectedMuscle.toLowerCase());
      if (!hasMuscle) return false;
    }

    // Equipment facet filter
    if (selectedEquipment !== 'all') {
      if (ex.equipment?.toLowerCase() !== selectedEquipment.toLowerCase()) {
        return false;
      }
    }

    // Difficulty facet filter
    if (selectedDifficulty !== 'all') {
      if (ex.difficulty?.toLowerCase() !== selectedDifficulty.toLowerCase()) {
        return false;
      }
    }

    return true;
  });
}

