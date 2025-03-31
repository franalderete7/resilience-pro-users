import { useState, useEffect, useCallback } from 'react';
import supabase from '@/utils/supabase';
import { Exercise } from '@/components/ExerciseCard';
import { useAuth } from '@/contexts/AuthContext';

// Define the Profile interface to match what is in ExerciseCard
interface Profile {
  uuid: string;
  name?: string;
  image?: string;
  email?: string;
}

export function useExercises() {
  console.log('🔍 useExercises hook initialized');
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Function to manually trigger a refresh
  const refreshExercises = useCallback(() => {
    console.log('🔄 Manually refreshing exercises...');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    console.log('🔄 useExercises useEffect triggered');
    
    async function fetchExercises() {
      console.log('📡 Starting to fetch exercises from Supabase...');
      if (!user) {
        console.log('⚠️ No user found, skipping fetch');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Get only exercises created by the current user
        console.log('🔍 Executing query to get exercises for user:', user.id);
        const { data, error } = await supabase
          .from('exercises')
          .select(`
            id, name, description, image, video, created_by
          `)
          .eq('created_by', user.id) // Filter by current user's ID
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('❌ Supabase error:', error);
          throw new Error(`Error al obtener ejercicios: ${error.message}`);
        }

        // Process exercises and fetch profiles separately
        let processedData: Exercise[] = [];
        
        if (data && data.length > 0) {
          // Get all unique creator IDs
          const creatorIds = [...new Set(data.map(ex => ex.created_by).filter(Boolean))];
          
          // Fetch all relevant profiles at once
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('uuid, name, email, image')
            .in('uuid', creatorIds);
            
          if (profilesError) {
            console.error('❌ Error fetching profiles:', profilesError);
          }
          
          // Map exercises to their creators
          processedData = data.map(exercise => {
            // Find matching profile
            const profile = profilesData?.find(p => p.uuid === exercise.created_by);
            
            // Create a properly structured creator object
            const creator = profile ? {
              uuid: profile.uuid,
              name: profile.name,
              email: profile.email,
              image: profile.image
            } : exercise.created_by ? { uuid: exercise.created_by } : undefined;
            
            return {
              id: exercise.id,
              name: exercise.name,
              description: exercise.description,
              image: exercise.image,
              video: exercise.video,
              created_by: exercise.created_by,
              creator
            };
          });
        } else {
          processedData = [];
        }

        console.log('✅ Setting exercises state with processed data');
        setExercises(processedData || []);
      } catch (err) {
        console.error('❌ Error in fetchExercises:', err);
        setError(err instanceof Error ? err.message : 'Failed to load exercises');
      } finally {
        setLoading(false);
      }
    }

    fetchExercises();
    
    // Clean-up function
    return () => {
      console.log('🧹 useExercises cleanup');
    };
  }, [refreshTrigger, user]); // Add user as dependency

  console.log('📤 useExercises returning:', { 
    exercisesCount: exercises.length, 
    loading, 
    hasError: !!error 
  });
  
  return { exercises, loading, error, refreshExercises };
} 