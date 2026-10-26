import { Exercise } from '../types';
import rawDataset from './exercisesDataset.json';

// Full 1,324 exercise dataset from hasaneyldrm/exercises-dataset
export const ALL_DATASET_EXERCISES: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>[] = rawDataset as Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>[];

// Curated starter selection
export const CURATED_EXERCISES: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>[] = ALL_DATASET_EXERCISES.slice(0, 60);
