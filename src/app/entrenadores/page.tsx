'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';

// Define the Trainer profile type
interface Trainer {
  uuid: string;
  name?: string;
  email?: string;
  image?: string;
  last_sign_in_at?: string;
  relationship?: {
    id: number;
    status: 'pending' | 'accepted' | 'rejected';
  };
}

export default function TrainersPage() {
  const { user } = useAuth();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchTrainers() {
      try {
        if (!user) return;
        
        setLoading(true);
        const supabase = createClientComponentClient();
        
        // Get all profiles with 'trainer' role
        const { data: trainerProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .contains('roles', ['trainer']);
        
        if (profilesError) {
          throw new Error(`Error al obtener entrenadores: ${profilesError.message}`);
        }
        
        // Get existing relationships for this user
        const { data: relationships, error: relationshipsError } = await supabase
          .from('trainer_user_relationships')
          .select('*')
          .eq('user_id', user.id);
        
        if (relationshipsError) {
          throw new Error(`Error al obtener relaciones: ${relationshipsError.message}`);
        }
        
        // Map relationships by trainer_id for easy lookup
        const relationshipsByTrainerId = (relationships || []).reduce((acc, rel) => {
          acc[rel.trainer_id] = rel;
          return acc;
        }, {} as Record<string, any>);
        
        // Process trainers with relationship status
        const processedTrainers = (trainerProfiles || []).map(trainer => {
          const relationship = relationshipsByTrainerId[trainer.uuid];
          
          return {
            uuid: trainer.uuid,
            name: trainer.name,
            email: trainer.email,
            image: trainer.image,
            last_sign_in_at: trainer.last_sign_in_at,
            relationship: relationship ? {
              id: relationship.id,
              status: relationship.status as 'pending' | 'accepted' | 'rejected'
            } : undefined
          };
        });
        
        setTrainers(processedTrainers);
      } catch (err) {
        console.error('Error fetching trainers:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar entrenadores');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTrainers();
  }, [user]);
  
  // Filter trainers based on search term
  const filteredTrainers = trainers.filter(trainer => {
    // Exclude our own profile from the list
    if (user && trainer.uuid === user.id) return false;
    
    const searchTermLower = searchTerm.toLowerCase();
    const name = (trainer.name || '').toLowerCase();
    const email = (trainer.email || '').toLowerCase();
    
    return name.includes(searchTermLower) || 
           (searchTerm.length > 3 && email.includes(searchTermLower));
  });
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  const handleSendRequest = async (trainerId: string) => {
    try {
      if (!user) return;
      
      setProcessingId(trainerId);
      const supabase = createClientComponentClient();
      
      // Check if a relationship already exists
      const { data: existingRelationship, error: checkError } = await supabase
        .from('trainer_user_relationships')
        .select('*')
        .eq('trainer_id', trainerId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (checkError) {
        throw new Error(`Error al verificar relación: ${checkError.message}`);
      }
      
      if (existingRelationship) {
        // Update the status if needed (e.g., if previously rejected)
        if (existingRelationship.status === 'rejected') {
          const { error: updateError } = await supabase
            .from('trainer_user_relationships')
            .update({ status: 'pending' })
            .eq('id', existingRelationship.id);
          
          if (updateError) {
            throw new Error(`Error al actualizar solicitud: ${updateError.message}`);
          }
        } else {
          throw new Error(`Ya tienes una solicitud ${existingRelationship.status === 'pending' ? 'pendiente' : 'aceptada'} con este entrenador`);
        }
      } else {
        // Create a new relationship
        const { error: insertError } = await supabase
          .from('trainer_user_relationships')
          .insert({
            trainer_id: trainerId,
            user_id: user.id,
            status: 'pending'
          });
        
        if (insertError) {
          throw new Error(`Error al enviar solicitud: ${insertError.message}`);
        }
      }
      
      // Update the local state
      setTrainers(trainers.map(trainer => {
        if (trainer.uuid === trainerId) {
          return {
            ...trainer,
            relationship: {
              id: existingRelationship?.id || 0, // Will be updated on next load
              status: 'pending'
            }
          };
        }
        return trainer;
      }));
      
      alert('Solicitud enviada correctamente');
    } catch (err) {
      console.error('Error sending request:', err);
      alert(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setProcessingId(null);
    }
  };
  
  const handleCancelRequest = async (trainerId: string) => {
    try {
      if (!user) return;
      
      const relationshipId = trainers.find(t => t.uuid === trainerId)?.relationship?.id;
      if (!relationshipId) return;
      
      setProcessingId(trainerId);
      const supabase = createClientComponentClient();
      
      const { error } = await supabase
        .from('trainer_user_relationships')
        .delete()
        .eq('id', relationshipId);
      
      if (error) {
        throw new Error(`Error al cancelar solicitud: ${error.message}`);
      }
      
      // Update the local state
      setTrainers(trainers.map(trainer => {
        if (trainer.uuid === trainerId) {
          return {
            ...trainer,
            relationship: undefined
          };
        }
        return trainer;
      }));
      
      alert('Solicitud cancelada correctamente');
    } catch (err) {
      console.error('Error canceling request:', err);
      alert(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setProcessingId(null);
    }
  };
  
  return (
    <>
      <Header />
      <main className="py-8 px-4 max-w-7xl mx-auto bg-black min-h-screen">
        <div className="space-y-8">
          {/* Page title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold text-white mb-4 sm:mb-0">
              <span className="text-blue-500">Entrenadores</span> Disponibles
            </h1>
            
            {/* Search box */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar entrenador..."
                className="w-full sm:w-64 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          {loading ? (
            <div className="flex justify-center p-12">
              <svg className="animate-spin w-10 h-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 border border-red-900 text-red-300 p-4 rounded-lg">
              <p>{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrainers.length === 0 ? (
                <div className="col-span-full p-8 text-center text-gray-400 bg-gray-900 rounded-lg shadow-lg border border-gray-800">
                  {searchTerm ? 'No se encontraron entrenadores que coincidan con tu búsqueda' : 'No hay entrenadores disponibles en este momento.'}
                </div>
              ) : (
                filteredTrainers.map((trainer) => (
                  <div key={trainer.uuid} className="bg-gray-900 rounded-lg shadow-lg overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors">
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-700 bg-gray-800 flex-shrink-0 flex items-center justify-center">
                          {trainer.image ? (
                            <Image
                              src={trainer.image}
                              alt={trainer.name || 'Entrenador'}
                              width={64}
                              height={64}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-900 text-white text-xl font-medium">
                              {((trainer.name || trainer.email || '?').charAt(0) || '?').toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white text-xl">{trainer.name || 'Entrenador Sin Nombre'}</div>
                          <div className="text-gray-400 text-sm mt-1">{trainer.email}</div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-400 mb-4">
                        <span className="block text-xs text-gray-500">Última conexión</span>
                        {formatDate(trainer.last_sign_in_at)}
                      </div>
                      
                      <div className="mt-6">
                        {trainer.relationship ? (
                          trainer.relationship.status === 'pending' ? (
                            <button
                              onClick={() => handleCancelRequest(trainer.uuid)}
                              className="w-full py-2 px-4 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors flex items-center justify-center"
                              disabled={processingId === trainer.uuid}
                            >
                              {processingId === trainer.uuid ? (
                                <svg className="animate-spin w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              Solicitud Pendiente
                            </button>
                          ) : (
                            <div className="w-full py-2 px-4 rounded-lg bg-green-900/20 text-green-400 text-center">
                              <svg className="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Entrenador Asignado
                            </div>
                          )
                        ) : (
                          <button
                            onClick={() => handleSendRequest(trainer.uuid)}
                            className="w-full py-2 px-4 rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition-colors flex items-center justify-center"
                            disabled={processingId === trainer.uuid}
                          >
                            {processingId === trainer.uuid ? (
                              <svg className="animate-spin w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                              </svg>
                            )}
                            Enviar Solicitud
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {/* Results count */}
          {searchTerm && filteredTrainers.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-400">
              Encontrados {filteredTrainers.length} {filteredTrainers.length === 1 ? 'entrenador' : 'entrenadores'} que coinciden con tu búsqueda
            </div>
          )}
        </div>
      </main>
    </>
  );
} 