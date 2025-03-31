import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Exercise } from '@/components/ExerciseCard';
import { useAuth } from '@/contexts/AuthContext';

// Import or define Profile interface.
interface Profile {
  uuid: string;
  name?: string;
  image?: string;
  email?: string;
}

export interface ExerciseInstance {
  id: number;
  reps: number;
  rest: number;
  block_id: number;
  exercise_id: number;
  exercise?: Exercise;
  created_by?: string;
  weight?: string;
}

export interface Block {
  id: number;
  name: string;
  rounds: number;
  workout_id: number;
  exercise_instances?: ExerciseInstance[];
  created_by?: string;
}

export interface Workout {
  id: number;
  name: string;
  created_at: string;
  updated_at?: string;
  created_by?: string; // UUID from profiles
  creator?: Profile; // Profile information
  blocks?: Block[];
  isAssigned?: boolean;
}

export function useWorkouts() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Function to manually trigger a refresh
  const refreshWorkouts = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    async function fetchWorkouts() {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const supabase = createClientComponentClient();
        
        // Get user profile to check role
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('roles')
          .eq('uuid', user.id)
          .single();
        
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
        }
        
        // Check if user has 'trainer' role
        const isTrainer = profileData?.roles?.includes('trainer') || false;
        
        let allWorkouts: Workout[] = [];
        
        if (isTrainer) {
          // For trainers: Fetch workouts created by the current user
          const { data: createdWorkouts, error: createdError } = await supabase
            .from('workouts')
            .select(`
              *,
              blocks (
                *,
                exercise_instances (
                  *,
                  exercise:exercises (*)
                )
              )
            `)
            .eq('created_by', user.id)
            .order('created_at', { ascending: false });
          
          if (createdError) {
            throw new Error(`Error al obtener rutinas creadas: ${createdError.message}`);
          }
          
          allWorkouts = createdWorkouts || [];
        }
        
        // For all users: Fetch workouts assigned to the user
        const { data: assignedWorkoutsData, error: assignedError } = await supabase
          .from('user_workouts')
          .select(`
            *,
            workout:workouts (
              *,
              blocks (
                *,
                exercise_instances (
                  *,
                  exercise:exercises (*)
                )
              )
            ),
            trainer:profiles!trainer_id (
              uuid,
              name,
              email,
              image
            )
          `)
          .eq('user_id', user.id);
        
        if (assignedError) {
          throw new Error(`Error al obtener rutinas asignadas: ${assignedError.message}`);
        }
        
        // Process assigned workouts
        const assignedWorkouts = (assignedWorkoutsData || []).map(assignment => {
          const workout = assignment.workout;
          if (!workout) return null;
          
          return {
            ...workout,
            creator: assignment.trainer,
            isAssigned: true
          };
        }).filter(Boolean) as Workout[];
        
        // Combine both arrays, ensuring no duplicates by ID
        const workoutIds = new Set();
        const combinedWorkouts: Workout[] = [];
        
        [...allWorkouts, ...assignedWorkouts].forEach(workout => {
          if (!workoutIds.has(workout.id)) {
            workoutIds.add(workout.id);
            combinedWorkouts.push(workout);
          }
        });
        
        // Get all unique creator IDs for workouts that might not have creator info
        const creatorIds = [...new Set(combinedWorkouts
          .filter(workout => workout.created_by && !workout.creator)
          .map(workout => workout.created_by)
          .filter(Boolean))];
        
        if (creatorIds.length > 0) {
          // Fetch profiles for all creators
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('uuid, name, email, image')
            .in('uuid', creatorIds);
          
          if (profilesError) {
            console.error('Error fetching creator profiles:', profilesError);
          }
          
          // Add creator info to workouts that don't have it
          combinedWorkouts.forEach(workout => {
            if (workout.created_by && !workout.creator) {
              const profile = profilesData?.find(p => p.uuid === workout.created_by);
              if (profile) {
                workout.creator = {
                  uuid: profile.uuid,
                  name: profile.name,
                  email: profile.email,
                  image: profile.image
                };
              }
            }
          });
        }
        
        setWorkouts(combinedWorkouts);
      } catch (err) {
        console.error('Error in fetchWorkouts:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar rutinas');
      } finally {
        setLoading(false);
      }
    }

    fetchWorkouts();
  }, [refreshTrigger, user]);
  
  return { workouts, loading, error, refreshWorkouts };
} 