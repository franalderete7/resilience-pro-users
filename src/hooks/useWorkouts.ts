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
        
        // Fetch workouts with all related data, filtered by current user
        const { data, error } = await supabase
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
          .eq('created_by', user.id) // Only show workouts created by the current user
          .order('created_at', { ascending: false });
        
        if (error) {
          throw new Error(`Error al obtener rutinas: ${error.message}`);
        }

        // Process workouts to add creator information
        let processedWorkouts: Workout[] = [];
        
        if (data && data.length > 0) {
          // Get all unique creator IDs
          const creatorIds = [...new Set(data
            .map(workout => workout.created_by)
            .filter(Boolean))];
          
          // Fetch profiles for all creators
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('uuid, name, email, image')
            .in('uuid', creatorIds);
          
          if (profilesError) {
            console.error('Error fetching creator profiles:', profilesError);
          }
          
          // Map profiles to workouts
          processedWorkouts = data.map(workout => {
            // Find matching profile
            const profile = profilesData?.find(p => p.uuid === workout.created_by);
            
            // Create a properly structured creator object
            const creator = profile ? {
              uuid: profile.uuid,
              name: profile.name,
              email: profile.email,
              image: profile.image
            } : workout.created_by ? { uuid: workout.created_by } : undefined;
            
            return {
              ...workout,
              creator
            };
          });
        } else {
          processedWorkouts = data || [];
        }

        setWorkouts(processedWorkouts);
      } catch (err) {
        console.error('Error in fetchWorkouts:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar rutinas');
      } finally {
        setLoading(false);
      }
    }

    fetchWorkouts();
  }, [refreshTrigger, user]); // Add user to dependency array
  
  return { workouts, loading, error, refreshWorkouts };
} 