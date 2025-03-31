'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from "@/components/Header";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Exercise } from '@/components/ExerciseCard';
import { useAuth } from '@/contexts/AuthContext';

// Define interfaces for our data structure
interface ExerciseInstance {
  id?: number;
  reps: number;
  rest: number;
  exercise_id: number;
  exercise?: Exercise;
  block_id?: number;
  weight?: string;
}

interface Block {
  id?: number;
  name: string;
  rounds: number;
  exercise_instances: ExerciseInstance[];
  workout_id?: number;
}

interface Workout {
  id?: number;
  name: string;
  blocks: Block[];
}

export default function CreateWorkoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Workout form state
  const [workout, setWorkout] = useState<Workout>({
    name: '',
    blocks: []
  });
  
  // State for the block being currently edited
  const [currentBlock, setCurrentBlock] = useState<Block>({
    name: '',
    rounds: 1,
    exercise_instances: []
  });
  
  // State for the exercise instance being currently edited
  const [currentExerciseInstance, setCurrentExerciseInstance] = useState<ExerciseInstance>({
    reps: 10,
    rest: 30,
    exercise_id: 0,
    weight: 'no weight'
  });
  
  // State to track which accordion sections are expanded
  const [expandedBlockIndex, setExpandedBlockIndex] = useState<number | null>(null);
  
  // Fetch exercises on component mount
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        // Only fetch exercises if the user is logged in
        if (!user?.id) {
          return;
        }
        
        setIsLoading(true);
        const supabase = createClientComponentClient();
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .eq('created_by', user.id) // Only fetch exercises created by this trainer
          .order('name');
        
        if (error) throw new Error(`Error al obtener ejercicios: ${error.message}`);
        
        setExercises(data || []);
      } catch (err) {
        console.error('Error fetching exercises:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar ejercicios');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchExercises();
  }, [user]); // Add user as a dependency to refetch when user changes
  
  // Handle workout name change
  const handleWorkoutNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkout({ ...workout, name: e.target.value });
  };
  
  // Handle current block name change
  const handleBlockNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentBlock({ ...currentBlock, name: e.target.value });
  };
  
  // Handle current block rounds change
  const handleBlockRoundsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rounds = parseInt(e.target.value);
    if (!isNaN(rounds) && rounds > 0) {
      setCurrentBlock({ ...currentBlock, rounds });
    }
  };
  
  // Add current block to workout
  const handleAddBlock = () => {
    if (!currentBlock.name.trim() || currentBlock.exercise_instances.length === 0) {
      alert('Por favor, añade un nombre de bloque y al menos una instancia de ejercicio');
      return;
    }
    
    setWorkout({
      ...workout,
      blocks: [...workout.blocks, { ...currentBlock }]
    });
    
    // Reset current block
    setCurrentBlock({
      name: '',
      rounds: 1,
      exercise_instances: []
    });
    
    // Expand the newly added block
    setExpandedBlockIndex(workout.blocks.length);
  };
  
  // Handle exercise selection for current exercise instance
  const handleExerciseSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const exercise_id = parseInt(e.target.value);
    if (!isNaN(exercise_id)) {
      setCurrentExerciseInstance({ ...currentExerciseInstance, exercise_id });
    }
  };
  
  // Handle reps change for current exercise instance
  const handleRepsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const reps = parseInt(e.target.value);
    if (!isNaN(reps) && reps > 0) {
      setCurrentExerciseInstance({ ...currentExerciseInstance, reps });
    }
  };
  
  // Handle rest change for current exercise instance
  const handleRestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rest = parseInt(e.target.value);
    if (!isNaN(rest) && rest >= 0) {
      setCurrentExerciseInstance({ ...currentExerciseInstance, rest });
    }
  };
  
  // Add a handle weight change function
  const handleWeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentExerciseInstance({ ...currentExerciseInstance, weight: e.target.value });
  };
  
  // Add current exercise instance to current block
  const handleAddExerciseInstance = () => {
    if (currentExerciseInstance.exercise_id === 0) {
      alert('Por favor, selecciona un ejercicio');
      return;
    }
    
    // Find selected exercise to include in the instance
    const selectedExercise = exercises.find(ex => ex.id === currentExerciseInstance.exercise_id);
    
    setCurrentBlock({
      ...currentBlock,
      exercise_instances: [
        ...currentBlock.exercise_instances, 
        { 
          ...currentExerciseInstance,
          exercise: selectedExercise
        }
      ]
    });
    
    // Reset current exercise instance except exercise_id to make it easier to add multiple instances
    setCurrentExerciseInstance({
      reps: 10,
      rest: 30,
      exercise_id: currentExerciseInstance.exercise_id,
      weight: currentExerciseInstance.weight
    });
  };
  
  // Remove exercise instance from current block
  const handleRemoveExerciseInstance = (index: number) => {
    setCurrentBlock({
      ...currentBlock,
      exercise_instances: currentBlock.exercise_instances.filter((_, i) => i !== index)
    });
  };
  
  // Remove block from workout
  const handleRemoveBlock = (index: number) => {
    setWorkout({
      ...workout,
      blocks: workout.blocks.filter((_, i) => i !== index)
    });
    
    // Update expanded block index if necessary
    if (expandedBlockIndex === index) {
      setExpandedBlockIndex(null);
    } else if (expandedBlockIndex !== null && expandedBlockIndex > index) {
      setExpandedBlockIndex(expandedBlockIndex - 1);
    }
  };
  
  // Toggle block expansion
  const toggleBlockExpansion = (index: number) => {
    setExpandedBlockIndex(expandedBlockIndex === index ? null : index);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert('You must be logged in to create a workout');
      return;
    }
    
    if (!workout.name.trim()) {
      alert('Please enter a workout name');
      return;
    }
    
    if (workout.blocks.length === 0) {
      alert('Please add at least one block');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const supabase = createClientComponentClient();
      
      console.log('Creating workout with user ID:', user.id);
      
      // 1. Create the workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert({ 
          name: workout.name,
          created_by: user.id // This references the uuid column in profiles table
        })
        .select('id')
        .single();
      
      if (workoutError) throw new Error(`Failed to create workout: ${workoutError.message}`);
      
      const workoutId = workoutData.id;
      
      // 2. Create blocks for the workout
      for (const block of workout.blocks) {
        const { data: blockData, error: blockError } = await supabase
          .from('blocks')
          .insert({
            name: block.name,
            rounds: block.rounds,
            workout_id: workoutId,
            created_by: user.id // This references the uuid column in profiles table
          })
          .select('id')
          .single();
        
        if (blockError) throw new Error(`Failed to create block: ${blockError.message}`);
        
        const blockId = blockData.id;
        
        // 3. Create exercise instances for each block
        const exerciseInstances = block.exercise_instances.map(instance => ({
          reps: instance.reps,
          rest: instance.rest,
          exercise_id: instance.exercise_id,
          block_id: blockId,
          weight: instance.weight,
          created_by: user.id // This references the uuid column in profiles table
        }));
        
        const { error: instancesError } = await supabase
          .from('exercise_instances')
          .insert(exerciseInstances);
        
        if (instancesError) throw new Error(`Failed to create exercise instances: ${instancesError.message}`);
      }
      
      // Redirect to workouts page after successful creation
      router.push('/workouts');
      
    } catch (err) {
      console.error('Error creating workout:', err);
      alert(err instanceof Error ? err.message : 'Ha ocurrido un error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleBackClick = () => {
    router.push('/workouts');
  };
  
  if (isLoading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </>
    );
  }
  
  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-red-500">Error: {error}</div>
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
              className="mr-4 p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Back to workouts"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-white">Crear Rutina</h1>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Workout Name Section */}
            <div className="bg-gray-900 rounded-lg p-8 shadow-lg border border-gray-800">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Detalles de la Rutina
              </h2>
              <div>
                <label htmlFor="workout-name" className="block text-sm font-medium text-gray-300 mb-2">
                  Nombre de la Rutina
                </label>
                <input
                  type="text"
                  id="workout-name"
                  value={workout.name}
                  onChange={handleWorkoutNameChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-lg"
                  placeholder="Ingresa el nombre de la rutina"
                  required
                />
              </div>
            </div>
            
            {/* Added Blocks Section */}
            {workout.blocks.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-8 shadow-lg border border-gray-800">
                <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Bloques de Rutina ({workout.blocks.length})
                </h2>
                <div className="space-y-5">
                  {workout.blocks.map((block, blockIndex) => (
                    <div key={blockIndex} className="border border-gray-800 rounded-lg overflow-hidden shadow-md transform transition-transform hover:scale-[1.01]">
                      <div 
                        className="flex justify-between items-center p-5 bg-gradient-to-r from-gray-800 to-gray-900 cursor-pointer"
                        onClick={() => toggleBlockExpansion(blockIndex)}
                      >
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-white">{block.name}</h3>
                          <span className="ml-3 bg-blue-900 text-blue-200 text-xs px-3 py-1 rounded-full font-medium">
                            {block.rounds} {block.rounds === 1 ? 'ronda' : 'rondas'}
                          </span>
                          <span className="ml-3 text-gray-400 text-sm">
                            {block.exercise_instances.length} {block.exercise_instances.length === 1 ? 'ejercicio' : 'ejercicios'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveBlock(blockIndex);
                            }}
                            className="text-red-500 hover:text-red-400 mr-3 cursor-pointer rounded-full p-1 hover:bg-gray-700 transition-colors"
                            aria-label="Eliminar bloque"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <div className="p-1 rounded-full hover:bg-gray-700 transition-colors">
                            <svg 
                              className={`w-5 h-5 text-gray-300 transform transition-transform ${expandedBlockIndex === blockIndex ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24" 
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      {expandedBlockIndex === blockIndex && (
                        <div className="p-5 bg-gray-900 border-t border-gray-800">
                          <div className="space-y-3">
                            {block.exercise_instances.map((instance, instanceIndex) => (
                              <div key={instanceIndex} className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                                <div className="w-16 h-16 relative rounded-lg overflow-hidden mr-4 border border-gray-700">
                                  {instance.exercise?.image ? (
                                    <Image
                                      src={instance.exercise.image}
                                      alt={instance.exercise.name}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                      <span className="text-xs text-gray-400">No img</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-white font-medium mb-2">{instance.exercise?.name}</h4>
                                  <div className="flex text-xs text-gray-400 mt-1">
                                    <span className="inline-flex items-center mr-3 bg-gray-700 px-2 py-0.5 rounded-full">
                                      <svg className="w-4 h-4 mr-1.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      {instance.reps} reps
                                    </span>
                                    <span className="inline-flex items-center mr-3 bg-gray-700 px-2 py-0.5 rounded-full">
                                      <svg className="w-4 h-4 mr-1.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {instance.rest}s rest
                                    </span>
                                    <span className="inline-flex items-center bg-gray-700 px-2 py-0.5 rounded-full">
                                      <svg className="w-4 h-4 mr-1.5 text-purple-400" fill="currentColor" stroke="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14 4.14 5.57 2 7.71 3.43 9.14 2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22 14.86 20.57 16.29 22 17.71 20.57 19.14 18.43 16.29 19.86 19.86 18.43 22 16.29 20.57z" />
                                      </svg>
                                      {instance.weight || 'no weight'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Add New Block Section */}
            <div className="bg-gray-900 rounded-lg p-8 shadow-lg border border-gray-800">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Añadir Nuevo Bloque
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="block-name" className="block text-sm font-medium text-gray-300 mb-2">
                      Nombre del Bloque
                    </label>
                    <input
                      type="text"
                      id="block-name"
                      value={currentBlock.name}
                      onChange={handleBlockNameChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ingresa el nombre del bloque"
                    />
                  </div>
                  <div>
                    <label htmlFor="block-rounds" className="block text-sm font-medium text-gray-300 mb-2">
                      Rondas
                    </label>
                    <input
                      type="number"
                      id="block-rounds"
                      value={currentBlock.rounds}
                      onChange={handleBlockRoundsChange}
                      min="1"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* Exercise Instances Section */}
                <div className="mt-6">
                  <h3 className="text-xl font-medium text-white mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Instancias de Ejercicios
                  </h3>
                  
                  {currentBlock.exercise_instances.length > 0 && (
                    <div className="space-y-3 mb-6 max-h-80 overflow-y-auto pr-2 styled-scrollbar">
                      {currentBlock.exercise_instances.map((instance, index) => (
                        <div key={index} className="flex items-center p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors border border-gray-700">
                          <div className="w-16 h-16 relative rounded-lg overflow-hidden mr-4 border border-gray-700">
                            {instance.exercise?.image ? (
                              <Image
                                src={instance.exercise.image}
                                alt={instance.exercise.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                                <span className="text-xs text-gray-400">No img</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-white font-medium mb-2">{instance.exercise?.name}</h4>
                            <div className="flex text-xs text-gray-400 mt-1">
                              <span className="inline-flex items-center mr-3 bg-gray-700 px-2 py-0.5 rounded-full">
                                <svg className="w-4 h-4 mr-1.5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                {instance.reps} reps
                              </span>
                              <span className="inline-flex items-center mr-3 bg-gray-700 px-2 py-0.5 rounded-full">
                                <svg className="w-4 h-4 mr-1.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {instance.rest}s rest
                              </span>
                              <span className="inline-flex items-center bg-gray-700 px-2 py-0.5 rounded-full">
                                <svg className="w-4 h-4 mr-1.5 text-purple-400" fill="currentColor" stroke="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14 4.14 5.57 2 7.71 3.43 9.14 2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22 14.86 20.57 16.29 22 17.71 20.57 19.14 18.43 16.29 19.86 19.86 18.43 22 16.29 20.57z" />
                                </svg>
                                {instance.weight || 'no weight'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveExerciseInstance(index)}
                            className="text-red-500 hover:text-red-400 cursor-pointer rounded-full p-1 hover:bg-gray-700 transition-colors"
                            aria-label="Remove exercise instance"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="bg-gradient-to-b from-gray-800 to-gray-850 p-6 rounded-lg border border-gray-700 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                      <div>
                        <label htmlFor="exercise-select" className="block text-sm font-medium text-gray-300 mb-2">
                          Seleccionar Ejercicio
                        </label>
                        <select
                          id="exercise-select"
                          value={currentExerciseInstance.exercise_id}
                          onChange={handleExerciseSelect}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-colors"
                          style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
                        >
                          <option value="0" disabled>Selecciona un ejercicio</option>
                          {exercises.length > 0 ? (
                            exercises.map(exercise => (
                              <option key={exercise.id} value={exercise.id}>
                                {exercise.name}
                              </option>
                            ))
                          ) : (
                            <option value="0" disabled>No hay ejercicios disponibles - crea ejercicios primero</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="reps-input" className="block text-sm font-medium text-gray-300 mb-2">
                          Repeticiones
                        </label>
                        <input
                          type="number"
                          id="reps-input"
                          value={currentExerciseInstance.reps}
                          onChange={handleRepsChange}
                          min="1"
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="rest-input" className="block text-sm font-medium text-gray-300 mb-2">
                          Descanso (segundos)
                        </label>
                        <input
                          type="number"
                          id="rest-input"
                          value={currentExerciseInstance.rest}
                          onChange={handleRestChange}
                          min="0"
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="weight-select" className="block text-sm font-medium text-gray-300 mb-2">
                          Peso
                        </label>
                        <select
                          id="weight-select"
                          value={currentExerciseInstance.weight}
                          onChange={handleWeightChange}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-colors"
                          style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em", paddingRight: "2.5rem" }}
                        >
                          <option value="no weight">Sin peso</option>
                          <option value="light">Ligero</option>
                          <option value="medium">Medio</option>
                          <option value="heavy">Pesado</option>
                          <option value="very heavy">Muy pesado</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddExerciseInstance}
                        disabled={currentExerciseInstance.exercise_id === 0 || exercises.length === 0}
                        className={`px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors flex items-center ${
                          currentExerciseInstance.exercise_id === 0 || exercises.length === 0
                            ? 'opacity-50 cursor-not-allowed bg-blue-800'
                            : ''
                        }`}
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Añadir Ejercicio al Bloque
                      </button>
                    </div>
                    
                    {exercises.length === 0 && (
                      <div className="mt-4 p-4 bg-blue-900/30 border border-blue-800/50 rounded-lg text-blue-300 text-sm">
                        <div className="flex items-start">
                          <svg className="w-5 h-5 mr-2 mt-0.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-medium mb-1">No hay ejercicios disponibles</p>
                            <p>Para crear rutinas, primero debes crear algunos ejercicios. Ve a la sección de "Ejercicios" y crea algunos ejercicios para poder añadirlos a tus rutinas.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddBlock}
                    disabled={!currentBlock.name || currentBlock.exercise_instances.length === 0}
                    className={`px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md cursor-pointer transition-colors flex items-center ${
                      !currentBlock.name || currentBlock.exercise_instances.length === 0 
                        ? 'opacity-50 cursor-not-allowed' 
                        : ''
                    }`}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Añadir Bloque a la Rutina
                  </button>
                </div>
              </div>
            </div>
            
            {/* Submit Button */}
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleBackClick}
                className="px-6 py-3 text-gray-300 mr-4 hover:text-white"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={workout.name === '' || workout.blocks.length === 0 || isSubmitting}
                className={`px-6 py-3 bg-blue-600 text-white rounded-md shadow-md flex items-center ${
                  workout.name === '' || workout.blocks.length === 0 || isSubmitting 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  'Guardar Rutina'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
} 