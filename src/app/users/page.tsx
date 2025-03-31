'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';

// Define the Profile type with extended relationship info
interface Profile {
  uuid: string;
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  last_sign_in_at?: string;
  roles?: string[];
  relationship?: {
    id: number;
    status: 'pending' | 'accepted' | 'rejected';
  };
}

interface RelationshipResponse {
  id: number;
  status: string;
  user_id: string;
  user: any; // Using any to avoid complex typing issues
}

export default function UsersPage() {
  const { user } = useAuth();
  const [acceptedUsers, setAcceptedUsers] = useState<Profile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchUserRelationships() {
      try {
        if (!user) return;
        
        setLoading(true);
        const supabase = createClientComponentClient();
        
        // Get the trainer's profile to verify role
        const { data: trainerProfile, error: profileError } = await supabase
          .from('profiles')
          .select('roles')
          .eq('uuid', user.id)
          .single();
        
        if (profileError) {
          throw new Error(`Error al obtener perfil: ${profileError.message}`);
        }
        
        if (!trainerProfile.roles || !trainerProfile.roles.includes('trainer')) {
          throw new Error('Solo los entrenadores pueden acceder a esta página');
        }
        
        // First, get all relationships for this trainer
        const { data: relationships, error: relationshipsError } = await supabase
          .from('trainer_user_relationships')
          .select(`
            id,
            status,
            user_id,
            user:user_id (
              uuid,
              name,
              email,
              phone,
              image,
              last_sign_in_at,
              roles
            )
          `)
          .eq('trainer_id', user.id)
          .in('status', ['pending', 'accepted'])
          .order('created_at', { ascending: false });
        
        if (relationshipsError) {
          throw new Error(`Error al obtener relaciones: ${relationshipsError.message}`);
        }
        
        // Process the results to get accepted and pending users
        const accepted: Profile[] = [];
        const pending: Profile[] = [];
        
        if (relationships) {
          // Use type assertion to avoid complex typing issues
          const typedRelationships = relationships as any[];
          
          for (const rel of typedRelationships) {
            if (!rel.user) continue;
            
            // Create a profile object with the relationship data
            const profile: Profile = {
              uuid: rel.user.uuid,
              name: rel.user.name,
              email: rel.user.email,
              phone: rel.user.phone,
              image: rel.user.image,
              last_sign_in_at: rel.user.last_sign_in_at,
              roles: rel.user.roles,
              relationship: {
                id: rel.id,
                status: rel.status as 'pending' | 'accepted' | 'rejected'
              }
            };
            
            if (rel.status === 'accepted') {
              accepted.push(profile);
            } else if (rel.status === 'pending') {
              pending.push(profile);
            }
          }
        }
        
        setAcceptedUsers(accepted);
        setPendingUsers(pending);
      } catch (err) {
        console.error('Error fetching user relationships:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserRelationships();
  }, [user]);
  
  // Filter users based on search term
  const filteredAcceptedUsers = acceptedUsers.filter(profile => {
    const searchTermLower = searchTerm.toLowerCase();
    const name = (profile.name || '').toLowerCase();
    const email = (profile.email || '').toLowerCase();
    
    return name.includes(searchTermLower) || 
           (searchTerm.length > 3 && email.includes(searchTermLower));
  });
  
  const filteredPendingUsers = pendingUsers.filter(profile => {
    const searchTermLower = searchTerm.toLowerCase();
    const name = (profile.name || '').toLowerCase();
    const email = (profile.email || '').toLowerCase();
    
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
    }) + ' a las ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const handleAcceptUser = async (relationshipId: number) => {
    try {
      const userId = pendingUsers.find(p => p.relationship?.id === relationshipId)?.uuid;
      if (!userId) return;
      
      setProcessingId(userId);
      const supabase = createClientComponentClient();
      
      const { error } = await supabase
        .from('trainer_user_relationships')
        .update({ status: 'accepted' })
        .eq('id', relationshipId);
      
      if (error) throw new Error(`Error al aceptar usuario: ${error.message}`);
      
      // Move the user from pending to accepted
      const acceptedUser = pendingUsers.find(p => p.relationship?.id === relationshipId);
      if (acceptedUser) {
        acceptedUser.relationship!.status = 'accepted';
        setAcceptedUsers([...acceptedUsers, acceptedUser]);
        setPendingUsers(pendingUsers.filter(p => p.relationship?.id !== relationshipId));
      }
    } catch (err) {
      console.error('Error accepting user:', err);
      alert(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setProcessingId(null);
    }
  };
  
  const handleRejectUser = async (relationshipId: number) => {
    try {
      const userId = pendingUsers.find(p => p.relationship?.id === relationshipId)?.uuid;
      if (!userId) return;
      
      setProcessingId(userId);
      const supabase = createClientComponentClient();
      
      const { error } = await supabase
        .from('trainer_user_relationships')
        .update({ status: 'rejected' })
        .eq('id', relationshipId);
      
      if (error) throw new Error(`Error al rechazar usuario: ${error.message}`);
      
      // Remove from pending users
      setPendingUsers(pendingUsers.filter(p => p.relationship?.id !== relationshipId));
    } catch (err) {
      console.error('Error rejecting user:', err);
      alert(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setProcessingId(null);
    }
  };
  
  const handleRemoveUser = async (relationshipId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar a este usuario?')) return;
    
    try {
      const userId = acceptedUsers.find(p => p.relationship?.id === relationshipId)?.uuid;
      if (!userId) return;
      
      setProcessingId(userId);
      const supabase = createClientComponentClient();
      
      // First, delete all workout assignments for this user
      const { error: workoutsError } = await supabase
        .from('user_workouts')
        .delete()
        .eq('user_id', userId)
        .eq('trainer_id', user?.id);
      
      if (workoutsError) throw new Error(`Error al eliminar rutinas: ${workoutsError.message}`);
      
      // Then update the relationship status to rejected
      const { error } = await supabase
        .from('trainer_user_relationships')
        .update({ status: 'rejected' })
        .eq('id', relationshipId);
      
      if (error) throw new Error(`Error al eliminar usuario: ${error.message}`);
      
      // Remove from accepted users
      setAcceptedUsers(acceptedUsers.filter(p => p.relationship?.id !== relationshipId));
    } catch (err) {
      console.error('Error removing user:', err);
      alert(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setProcessingId(null);
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
  
  return (
    <>
      <Header />
      <main className="min-h-screen p-8 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Usuarios</h1>
            <p className="text-gray-400 mt-2">
              {acceptedUsers.length} {acceptedUsers.length === 1 ? 'usuario' : 'usuarios'} activos y {pendingUsers.length} {pendingUsers.length === 1 ? 'solicitud' : 'solicitudes'} pendientes
            </p>
            
            {/* Search input */}
            <div className="mt-4 relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Buscar usuarios por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Pending requests section */}
          {pendingUsers.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Solicitudes Pendientes
              </h2>
              
              <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden border border-yellow-800/30">
                <div className="divide-y divide-gray-800">
                  {filteredPendingUsers.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      {searchTerm ? 'No se encontraron solicitudes pendientes que coincidan con tu búsqueda' : 'No hay solicitudes pendientes'}
                    </div>
                  ) : (
                    filteredPendingUsers.map((profile) => (
                      <div key={profile.uuid} className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-6 items-center hover:bg-gray-800/50 transition-colors">
                        <div className="col-span-1 lg:col-span-2 flex items-center gap-5">
                          <div className="w-14 h-14 rounded-full overflow-hidden border border-yellow-600/30 bg-gray-800 flex-shrink-0 flex items-center justify-center">
                            {profile.image ? (
                              <Image
                                src={profile.image}
                                alt={profile.name || 'Usuario'}
                                width={56}
                                height={56}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-yellow-900/50 text-white text-lg font-medium">
                                {((profile.name || profile.email || '?').charAt(0) || '?').toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white text-lg">{profile.name || 'Usuario Sin Nombre'}</div>
                            <div className="text-gray-400 text-sm">{profile.email}</div>
                          </div>
                        </div>
                        
                        <div className="hidden lg:flex items-center col-span-1">
                          <div className="bg-gray-800 p-2 rounded-full mr-3">
                            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Solicitud</span>
                            <span className="text-yellow-400">Pendiente</span>
                          </div>
                        </div>

                        <div className="col-span-1 lg:col-span-2 flex gap-2 justify-end">
                          <button
                            onClick={() => handleRejectUser(profile.relationship?.id || 0)}
                            disabled={processingId === profile.uuid}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
                          >
                            Rechazar
                          </button>
                          <button
                            onClick={() => handleAcceptUser(profile.relationship?.id || 0)}
                            disabled={processingId === profile.uuid}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                          >
                            {processingId === profile.uuid ? 'Procesando...' : 'Aceptar'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Accepted users section */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Usuarios Activos
            </h2>
            
            <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden border border-gray-800">
              <div className="divide-y divide-gray-800">
                {filteredAcceptedUsers.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    {searchTerm ? 'No se encontraron usuarios que coincidan con tu búsqueda' : 'No tienes usuarios activos. Acepta solicitudes para comenzar.'}
                  </div>
                ) : (
                  filteredAcceptedUsers.map((profile) => (
                    <div key={profile.uuid} className="grid grid-cols-4 gap-6 p-6 items-center hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-700 bg-gray-800 flex-shrink-0 flex items-center justify-center">
                          {profile.image ? (
                            <Image
                              src={profile.image}
                              alt={profile.name || 'Usuario'}
                              width={56}
                              height={56}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-900 text-white text-lg font-medium">
                              {((profile.name || profile.email || '?').charAt(0) || '?').toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white text-lg">{profile.name || 'Usuario Sin Nombre'}</div>
                          <div className="mt-1">
                            <a 
                              href={`/users/${profile.uuid}`} 
                              className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center gap-1 transition-colors"
                            >
                              Ver Perfil
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <div className="bg-gray-800 p-2 rounded-full mr-3">
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block">Correo Electrónico</span>
                          <span className="text-gray-300 truncate">{profile.email || 'No proporcionado'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <div className="bg-gray-800 p-2 rounded-full mr-3">
                          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block">Teléfono</span>
                          <span className="text-gray-300">{profile.phone || 'No proporcionado'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleRemoveUser(profile.relationship?.id || 0)}
                          className="inline-flex items-center justify-center p-2 rounded-full bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition-colors"
                          title="Eliminar usuario"
                          disabled={processingId === profile.uuid}
                        >
                          {processingId === profile.uuid ? (
                            <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* Results count */}
          {searchTerm && (
            <div className="mt-4 text-center text-sm text-gray-400">
              Encontrados {filteredAcceptedUsers.length} {filteredAcceptedUsers.length === 1 ? 'usuario activo' : 'usuarios activos'} y {filteredPendingUsers.length} {filteredPendingUsers.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} que coinciden con tu búsqueda
            </div>
          )}
        </div>
      </main>
    </>
  );
} 