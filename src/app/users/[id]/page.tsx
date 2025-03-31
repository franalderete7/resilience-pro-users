'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Header';
import { Workout } from '@/hooks/useWorkouts';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  uuid: string;
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  last_sign_in_at?: string;
}

interface UserWorkout {
  id: string;
  user_id: string;
  workout_id: number;
  added_at: string;
  workout?: Workout;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userWorkouts, setUserWorkouts] = useState<UserWorkout[]>([]);
  const [availableWorkouts, setAvailableWorkouts] = useState<Workout[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get user ID from params using the useParams hook
  const userId = params.id as string;
  
  useEffect(() => {
    if (!userId) {
      setError('User ID is missing');
      setLoading(false);
      return;
    }

    // Make sure user is available before fetching
    if (!user || !user.id) {
      // Still loading user, maintain loading state
      return;
    }

    // At this point we're sure user exists and has an ID
    const currentUser = user; // Create a scoped variable that TypeScript knows is non-null

    async function fetchUserData() {
      try {
        setLoading(true);
        const supabase = createClientComponentClient();
        
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('uuid', userId)
          .single();
        
        if (profileError) {
          throw new Error(`Error al obtener perfil: ${profileError.message}`);
        }
        
        setProfile(profileData);
        
        // Fetch user's workouts - using trainer_id from current user
        const { data: userWorkoutsData, error: userWorkoutsError } = await supabase
          .from('user_workouts')
          .select(`
            *,
            workout:workout_id (id, name, created_at)
          `)
          .eq('user_id', userId)
          .eq('trainer_id', currentUser.id);
        
        if (userWorkoutsError) {
          throw new Error(`Error al obtener rutinas del usuario: ${userWorkoutsError.message}`);
        }
        
        setUserWorkouts(userWorkoutsData || []);
        
        // Fetch all available workouts from current trainer
        const { data: workoutsData, error: workoutsError } = await supabase
          .from('workouts')
          .select('*')
          .eq('created_by', currentUser.id)
          .order('name');
        
        if (workoutsError) {
          throw new Error(`Error al obtener rutinas: ${workoutsError.message}`);
        }
        
        // Set all available workouts - we'll filter them in the render function
        setAvailableWorkouts(workoutsData || []);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar datos del usuario');
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserData();
  }, [userId, user]); // Add user as a dependency

  // Filter out already assigned workouts
  const unassignedWorkouts = availableWorkouts.filter(workout => 
    !userWorkouts.some(userWorkout => userWorkout.workout_id === workout.id)
  );

  const handleAssignWorkout = async () => {
    if (!selectedWorkoutId) return;
    if (!user?.id) {
      setError('No se puede asignar rutina: Información del entrenador no disponible');
      return;
    }
    
    try {
      setIsAssigning(true);
      setError(null); // Clear any previous errors
      const supabase = createClientComponentClient();
      
      // Double check if workout is already assigned (should not be possible with UI filtering, but still good practice)
      const isAlreadyAssigned = userWorkouts.some(uw => uw.workout_id === selectedWorkoutId);
      if (isAlreadyAssigned) {
        setError('Esta rutina ya está asignada al usuario');
        return;
      }
      
      // Assign workout to user
      const { data, error } = await supabase
        .from('user_workouts')
        .insert([{
          user_id: userId,
          workout_id: selectedWorkoutId,
          trainer_id: user.id
        }])
        .select();
      
      if (error) {
        throw new Error(`Error al asignar rutina: ${error.message}`);
      }
      
      // Find the workout details to add to the list
      const assignedWorkout = availableWorkouts.find(w => w.id === selectedWorkoutId);
      if (data && data[0] && assignedWorkout) {
        setUserWorkouts(prevWorkouts => [...prevWorkouts, {
          ...data[0],
          workout: assignedWorkout
        }]);
      }
      
      setSelectedWorkoutId(null);
      setSuccessMessage('¡Rutina asignada con éxito al usuario!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error assigning workout:', err);
      setError(err instanceof Error ? err.message : 'Error al asignar rutina');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveWorkout = async (workoutId: number) => {
    if (!user?.id) {
      setError('No se puede eliminar rutina: Información del entrenador no disponible');
      return;
    }
    
    try {
      setIsAssigning(true);
      setError(null); // Clear any previous errors
      const supabase = createClientComponentClient();
      
      const { error } = await supabase
        .from('user_workouts')
        .delete()
        .eq('user_id', userId)
        .eq('workout_id', workoutId)
        .eq('trainer_id', user.id);
      
      if (error) {
        throw new Error(`Error al eliminar rutina: ${error.message}`);
      }
      
      // Update local state using functional update to ensure we have the latest state
      setUserWorkouts(prevWorkouts => prevWorkouts.filter(uw => uw.workout_id !== workoutId));
      
      setSuccessMessage('¡Rutina eliminada con éxito del usuario!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error removing workout:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar rutina');
    } finally {
      setIsAssigning(false);
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' a las ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
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
  
  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-red-500 p-4 bg-gray-900 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>{error}</p>
          </div>
        </div>
      </>
    );
  }
  
  if (!profile) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="text-red-500 p-4 bg-gray-900 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-2">Usuario no encontrado</h2>
            <p>El usuario solicitado no pudo ser encontrado.</p>
          </div>
        </div>
      </>
    );
  }
  
  return (
    <>
      <Header />
      <main className="min-h-screen p-8 bg-black">
        <div className="max-w-6xl mx-auto">
          <button 
            onClick={() => {
              // Use direct navigation instead of router.back() to avoid the profile update error
              router.push('/users');
            }} 
            className="mb-8 flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Usuarios
          </button>
          
          {/* User Profile Section - Enhanced */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700 mb-8">
            <div className="p-8 flex flex-col md:flex-row items-center md:items-start gap-8">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-600 bg-gray-800 flex-shrink-0 flex items-center justify-center shadow-lg">
                {profile.image ? (
                  <Image
                    src={profile.image}
                    alt={profile.name || 'Usuario'}
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 text-white text-3xl font-bold">
                    {((profile.name || profile.email || '?').charAt(0) || '?').toUpperCase()}
                  </div>
                )}
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-white mb-4">{profile.name || 'Usuario Sin Nombre'}</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-sm">Correo Electrónico</span>
                    <span className="text-white">{profile.email || 'No proporcionado'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-sm">Teléfono</span>
                    <span className="text-white">{profile.phone || 'No proporcionado'}</span>
                  </div>
                  <div className="flex flex-col md:col-span-2">
                    <span className="text-gray-500 text-sm">Última Actividad</span>
                    <span className="text-white">{formatDate(profile.last_sign_in_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Success Message - Enhanced */}
          {successMessage && (
            <div className="mb-8 bg-green-900/60 border border-green-600 text-green-300 p-4 rounded-lg flex items-center shadow-lg animate-fadeIn">
              <svg className="w-5 h-5 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}
          
          {/* Assign Workout Section - Enhanced */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <svg className="w-6 h-6 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Asignar Rutina
            </h2>
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl shadow-xl overflow-hidden border border-gray-700 p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <label htmlFor="workout-select" className="block text-gray-400 text-sm mb-2">Selecciona una rutina para asignar</label>
                  <select
                    id="workout-select"
                    value={selectedWorkoutId || ''}
                    onChange={(e) => setSelectedWorkoutId(Number(e.target.value) || null)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg text-white py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="">Seleccionar una rutina</option>
                    {unassignedWorkouts.length > 0 ? (
                      unassignedWorkouts.map(workout => (
                        <option key={workout.id} value={workout.id}>{workout.name}</option>
                      ))
                    ) : (
                      <option value="" disabled>No hay más rutinas disponibles para asignar</option>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 top-6 flex items-center px-3 text-gray-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="md:self-end">
                  <button
                    onClick={handleAssignWorkout}
                    disabled={!selectedWorkoutId || isAssigning || unassignedWorkouts.length === 0}
                    className={`w-full md:w-auto px-8 py-3 rounded-lg font-medium flex justify-center items-center gap-2 ${
                      !selectedWorkoutId || isAssigning || unassignedWorkouts.length === 0
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-colors shadow-lg'
                    }`}
                  >
                    {isAssigning ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Asignando...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Asignar Rutina
                      </>
                    )}
                  </button>
                </div>
              </div>
              {unassignedWorkouts.length === 0 && (
                <div className="mt-4 text-sm text-gray-400">
                  Todas las rutinas disponibles ya han sido asignadas a este usuario.
                </div>
              )}
            </div>
          </div>
          
          {/* User's Workouts Section - Enhanced */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <svg className="w-6 h-6 mr-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Rutinas del Usuario
            </h2>
            {userWorkouts.length === 0 ? (
              <div className="bg-gray-900/70 rounded-xl shadow-lg overflow-hidden border border-gray-800 p-10 text-center text-gray-400">
                <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-lg">Este usuario no tiene rutinas asignadas todavía.</p>
                <p className="mt-2 text-sm text-gray-500">Usa la sección de asignar rutina arriba para comenzar.</p>
              </div>
            ) : (
              <div className="bg-gray-900/70 rounded-xl shadow-lg overflow-hidden border border-gray-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-800/80 border-b border-gray-700">
                      <tr>
                        <th className="p-4 text-gray-400 font-medium">Nombre de la Rutina</th>
                        <th className="p-4 text-gray-400 font-medium">Fecha de Asignación</th>
                        <th className="p-4 text-gray-400 font-medium text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {userWorkouts.map((userWorkout) => (
                        <tr key={userWorkout.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 text-white font-medium">
                            {userWorkout.workout?.name || `Rutina #${userWorkout.workout_id}`}
                          </td>
                          <td className="p-4 text-gray-300">
                            {formatDate(userWorkout.added_at)}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleRemoveWorkout(userWorkout.workout_id)}
                              className="inline-flex items-center justify-center p-2 rounded-full bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition-colors"
                              title="Eliminar rutina"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
} 