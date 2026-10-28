export type UserRole = 'user' | 'pro' | 'admin';

export interface UserProfile {
  uid: string;
  displayName?: string;
  email: string;
  photoURL?: string;
  preferredUnits?: 'metric' | 'imperial';
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleRecord {
  uid: string;
  role: UserRole;
  grantedAt: string;
  grantedBy: string;
}

export interface TvUserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role?: string;
  pairedAt?: string;
}

export interface PairedDevice {
  deviceUid: string;
  deviceName: string;
  pairedAt: string;
  lastSeenAt?: string;
  active: boolean;
  lastPairingSessionId?: string;
  pairingCode?: string;
  userEmail?: string;
}

export interface PairingSession {
  sessionId: string;
  pairingCode: string;
  deviceUid: string;
  deviceName: string;
  status: 'pending' | 'paired' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string;
  pairedByUid?: string;
  pairedAt?: string;
  userAccount?: TvUserAccount;
}

export interface Exercise {
  id: string;
  name: string;
  slug: string;
  description: string;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  equipment: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  mediaUrl: string;
  mediaType: 'video/mp4' | 'image/gif' | 'image/svg+xml';
  posterUrl?: string;
  durationSeconds?: number;
  loop?: boolean;
  estimatedSizeBytes?: number;
  sourceUrl?: string;
  licenceName?: string;
  attributionText?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  // GIF Accuracy & Verification
  isGifWrong?: boolean;
  gifStatus?: 'correct' | 'wrong' | 'unreviewed';
  gifFeedbackNote?: string;
  flaggedAt?: string;
  flaggedBy?: string;
}

export interface ExerciseVerificationFlag {
  exerciseId: string;
  isGifWrong: boolean;
  status: 'correct' | 'wrong';
  reason?: string;
  flaggedAt: string;
  flaggedBy?: string;
  reporterEmail?: string;
}

export interface RoutineItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  mediaUrl?: string;
  mediaType?: 'video/mp4' | 'image/gif' | 'image/svg+xml';
  position: number;
  sets: number;
  reps: number;
  workSeconds?: number;
  restSeconds: number;
  instructions?: string;
}

export interface Routine {
  id: string;
  ownerUid: string;
  ownerName?: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDurationSeconds: number;
  visibility: 'private' | 'public';
  status: 'draft' | 'published' | 'archived';
  items: RoutineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  active: boolean;
  startAt: string;
  endAt: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}
