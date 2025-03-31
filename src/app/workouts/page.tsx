'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from "@/components/Header";
import { useWorkouts, Workout } from '@/hooks/useWorkouts';
import WorkoutCard from '@/components/WorkoutCard';

export default function WorkoutsPage() {
  const router = useRouter();
  const { workouts: fetchedWorkouts, loading, error, refreshWorkouts } = useWorkouts();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Update local state when workouts are fetched
  useEffect(() => {
    if (fetchedWorkouts) {
      setWorkouts(fetchedWorkouts);
    }
  }, [fetchedWorkouts]);

  const handleBackClick = () => {
    router.push('/');
  };

  const handleAddClick = () => {
    // Navigate to workout creation page
    router.push('/workouts/create');
  };

  // Handle workout deletion in local state
  const handleWorkoutDelete = (workoutId: number) => {
    // Update local state immediately for a responsive UI
    setWorkouts(prevWorkouts => prevWorkouts.filter(workout => workout.id !== workoutId));
  };

  // Filter workouts based on search term
  const filteredWorkouts = workouts.filter(workout => 
    workout.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && workouts.length === 0) {
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
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={handleBackClick}
                className="mr-4 p-2 rounded-full hover:bg-gray-800 transition-colors"
                aria-label="Back to home"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white">Tus Rutinas</h1>
                <p className="text-gray-400 mt-2">Administra tus rutinas de entrenamiento</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <button
                onClick={handleAddClick}
                className="flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 focus:outline-none shadow-lg transition-colors text-white font-medium cursor-pointer"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Añadir Rutina
              </button>
            </div>
          </div>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="Buscar rutinas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {filteredWorkouts.length === 0 ? (
            <div className="bg-gray-900 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">No se encontraron rutinas. ¡Haz clic en el botón "Añadir Rutina" para comenzar!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorkouts.map(workout => (
                <WorkoutCard 
                  key={workout.id} 
                  workout={workout} 
                  onDelete={handleWorkoutDelete}
                  refreshWorkouts={refreshWorkouts}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
} 