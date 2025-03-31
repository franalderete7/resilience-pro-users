'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Header from "@/components/Header";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Workout, Block, ExerciseInstance } from '@/hooks/useWorkouts';
import VideoModal from '@/components/VideoModal';

export default function WorkoutDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<{[key: number]: boolean}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [currentExerciseName, setCurrentExerciseName] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to manually refresh workout data
  const refreshWorkout = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const fetchWorkout = async () => {
      if (!workoutId) return;
      
      try {
        setLoading(true);
        const supabase = createClientComponentClient();
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
          .eq('id', workoutId)
          .single();
        
        if (error) throw new Error(`Failed to fetch workout: ${error.message}`);
        
        setWorkout(data);
        
        // Initialize expanded state
        if (data.blocks) {
          const initialExpandedState: {[key: number]: boolean} = {};
          data.blocks.forEach((block: Block) => {
            initialExpandedState[block.id] = false;
          });
          setExpandedBlocks(initialExpandedState);
        }
      } catch (err) {
        console.error('Error fetching workout:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar la rutina');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkout();
  }, [workoutId, refreshTrigger]); // Add refreshTrigger as dependency

  const handleBackClick = () => {
    router.push('/workouts');
  };

  const toggleBlock = (blockId: number) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }));
  };

  const handleExerciseClick = (exercise: any) => {
    if (exercise?.video) {
      setCurrentVideo(exercise.video);
      setCurrentExerciseName(exercise.name);
      setIsVideoModalOpen(true);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </>
    );
  }

  if (error || !workout) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-red-500">Error: {error || 'Workout not found'}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen p-8 bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-center">
            <button 
              onClick={handleBackClick}
              className="mr-4 p-2 rounded-full hover:bg-gray-800 transition-colors"
              aria-label="Back to workouts"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-white">{workout.name}</h1>
          </div>
          
          <div className="mb-6 bg-gray-900 p-4 rounded-lg">
            <p className="text-gray-400">
              Creada: {new Date(workout.created_at).toLocaleDateString()}
            </p>
            <p className="text-gray-400">
              Bloques: {workout.blocks?.length || 0}
            </p>
          </div>
          
          {workout.blocks && workout.blocks.length > 0 ? (
            <div className="space-y-4">
              {workout.blocks.map(block => (
                <div 
                  key={block.id} 
                  className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900"
                >
                  <button
                    onClick={() => toggleBlock(block.id)}
                    className="w-full flex justify-between items-center p-4 text-left focus:outline-none"
                  >
                    <div className="flex items-center">
                      <h2 className="text-xl font-semibold text-white">{block.name}</h2>
                      <span className="ml-3 bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded-full">
                        {block.rounds} {block.rounds === 1 ? 'ronda' : 'rondas'}
                      </span>
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${expandedBlocks[block.id] ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {expandedBlocks[block.id] && block.exercise_instances && block.exercise_instances.length > 0 && (
                    <div className="p-4 border-t border-gray-800 divide-y divide-gray-800">
                      {block.exercise_instances.map(instance => (
                        <div 
                          key={instance.id} 
                          className="py-3 cursor-pointer hover:bg-gray-800 rounded p-2 transition-colors"
                          onClick={() => instance.exercise && handleExerciseClick(instance.exercise)}
                        >
                          <div className="flex items-center">
                            {instance.exercise?.image && (
                              <div className="w-16 h-16 min-w-[4rem] min-h-[4rem] relative mr-4 rounded overflow-hidden flex-shrink-0">
                                <Image
                                  src={instance.exercise.image}
                                  alt={instance.exercise?.name || ''}
                                  fill
                                  quality={90}
                                  className="object-cover"
                                  loading="eager"
                                />
                              </div>
                            )}
                            <div>
                              <h3 className="text-white font-medium mb-2">
                                {instance.exercise?.name || 'Unknown Exercise'}
                              </h3>
                              <div className="flex flex-wrap gap-2 text-sm text-gray-400">
                                <span className="inline-flex items-center bg-gray-700 px-2 py-0.5 rounded-full">
                                  <svg className="w-3.5 h-3.5 mr-1 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  {instance.reps} reps
                                </span>
                                <span className="inline-flex items-center bg-gray-700 px-2 py-0.5 rounded-full">
                                  <svg className="w-3.5 h-3.5 mr-1 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {instance.rest}s descanso
                                </span>
                                {instance.weight && (
                                  <span className="inline-flex items-center bg-gray-700 px-2 py-0.5 rounded-full">
                                    <svg className="w-3.5 h-3.5 mr-1 text-purple-400" fill="currentColor" stroke="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14 4.14 5.57 2 7.71 3.43 9.14 2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22 14.86 20.57 16.29 22 17.71 20.57 19.14 18.43 16.29 19.86 19.86 18.43 22 16.29 20.57z" />
                                    </svg>
                                    {instance.weight}
                                  </span>
                                )}
                              </div>
                            </div>
                            {instance.exercise?.video && (
                              <svg className="w-5 h-5 text-blue-500 ml-auto" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path>
                              </svg>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">Esta rutina no tiene bloques.</p>
            </div>
          )}
        </div>
      </main>
      
      {isVideoModalOpen && currentVideo && (
        <VideoModal
          videoUrl={currentVideo}
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          title={`${currentExerciseName} - Video`}
        />
      )}
    </>
  );
} 