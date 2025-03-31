'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ExerciseCard, { Exercise } from '@/components/ExerciseCard';
import { useExercises } from '@/hooks/useExercises';
import Header from "@/components/Header";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAuth } from "@/contexts/AuthContext";

export default function ExercisesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { exercises: fetchedExercises, loading, error, refreshExercises } = useExercises();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showModal, setShowModal] = useState(false);
  const supabase = createClientComponentClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Update local state when exercises are fetched
  useEffect(() => {
    if (fetchedExercises) {
      setExercises(fetchedExercises);
    }
  }, [fetchedExercises]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState('');

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    console.log('📊 Exercises Page State:', {
      exercisesCount: exercises?.length,
      loading,
      error
    });
    
    if (exercises?.length > 0) {
      console.log('📝 First exercise has creator:', !!exercises[0].creator);
    }
  }, [exercises, loading, error, user]);

  const handleBackClick = () => {
    router.push('/');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'video/mp4') {
        setFormError('Por favor, sube un archivo de video MP4');
        return;
      }
      setVideoFile(file);
      setFormError('');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setFormError('Por favor, sube un archivo de imagen válido');
        return;
      }
      setImageFile(file);
      setFormError('');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: ''
    });
    setVideoFile(null);
    setImageFile(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    setUploadProgress(0);
    setFormError('');
  };

  // Handler to refresh exercises after changes
  const handleRefetchExercises = () => {
    refreshExercises();
  };

  // Sanitize filename to remove special characters and accents
  const sanitizeFilename = (filename: string): string => {
    // Remove accents/diacritics
    const withoutAccents = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Replace spaces and other problematic characters
    return withoutAccents.replace(/[^a-zA-Z0-9_.-]/g, '_');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚨🚨🚨 EXERCISE SUBMISSION STARTED 🚨🚨🚨');
    
    if (!videoFile || !imageFile) {
      setFormError('Por favor, sube tanto un video como una imagen');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    
    try {
      // Generate unique file names
      const timestamp = Date.now();
      const sanitizedVideoName = sanitizeFilename(videoFile.name);
      const sanitizedImageName = sanitizeFilename(imageFile.name);
      const videoFileName = `${timestamp}_${sanitizedVideoName}`;
      const imageFileName = `${timestamp}_${sanitizedImageName}`;

      // Upload video file
      const { data: videoData, error: videoError } = await supabase.storage
        .from('exercises')
        .upload(`videos/${videoFileName}`, videoFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (videoError) throw new Error(`Error al subir el video: ${videoError.message}`);
      setUploadProgress(50);

      // Upload image file
      const { data: imageData, error: imageError } = await supabase.storage
        .from('exercises')
        .upload(`images/${imageFileName}`, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (imageError) throw new Error(`Error al subir la imagen: ${imageError.message}`);
      setUploadProgress(75);

      // Get public URLs
      const videoUrl = supabase.storage
        .from('exercises')
        .getPublicUrl(`videos/${videoFileName}`).data.publicUrl;
      
      const imageUrl = supabase.storage
        .from('exercises')
        .getPublicUrl(`images/${imageFileName}`).data.publicUrl;

      if (!user) {
        throw new Error('Debes iniciar sesión para crear ejercicios');
      }
      
      // Extensive debug logging
      console.log('💡 Debug - User object details:', {
        id: user.id,
        email: user.email,
        userType: typeof user.id,
        userIdLength: user.id?.length
      });
      
      console.log('Creating exercise with user ID:', user.id);

      // First, verify if a profile exists for this user
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('uuid')
        .eq('uuid', user.id)
        .single();
        
      console.log('📋 Profile check result:', { 
        profileData, 
        profileError,
        hasProfile: !!profileData
      });
      
      // Create exercise record
      console.log('🔥 Attempting exercise creation with a different approach');
      
      // Method 1: Standard Insert
      console.log('Creating exercise with created_by as UUID:', user.id);
      
      const exercisePayload = {
        name: formData.name,
        description: formData.description,
        video: videoUrl,
        image: imageUrl,
        created_by: user.id // This is now a UUID
      };
      
      console.log('Exercise payload:', exercisePayload);
      
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .insert(exercisePayload)
        .select('*'); // Explicitly request all fields to be returned

      if (exerciseError) {
        console.error('❌ Debug - Exercise insert error:', exerciseError);
        
        // Method 2: Try direct RPC call to bypass RLS issues
        console.log('🔄 Trying alternate method: RPC call');
        
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_exercise', {
          p_name: formData.name,
          p_description: formData.description,
          p_video: videoUrl,
          p_image: imageUrl,
          p_created_by: user.id // Passing UUID
        });
        
        if (rpcError) {
          console.error('❌ Debug - RPC error:', rpcError);
          
          // Method 3: Try with manual query parameter
          console.log('🔄 Trying final method: Execute SQL directly');
          
          // Show what SQL would be executed
          console.log(`SQL that would be run: INSERT INTO exercises(name, description, video, image, created_by) VALUES('${formData.name}', '${formData.description}', '${videoUrl}', '${imageUrl}', '${user.id}') RETURNING *`);
          
          throw new Error(`Error al crear ejercicio: ${exerciseError.message}`);
        } else {
          console.log('✅ Debug - Exercise created successfully via RPC:', rpcData);
        }
      } else {
        console.log('✅ Debug - Exercise created successfully via standard insert:', exerciseData);
      }
      
      setUploadProgress(100);
      
      // Close modal and reset form
      resetForm();
      setShowModal(false);
      
      // Refresh exercises immediately
      handleRefetchExercises();
      
    } catch (error) {
      console.error('Error creating exercise:', error);
      setFormError(error instanceof Error ? error.message : 'Ha ocurrido un error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter exercises based on search term
  const filteredExercises = exercises.filter(exercise => 
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exercise.description && exercise.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading && exercises.length === 0) {
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
                <h1 className="text-3xl font-bold text-white">Biblioteca de Ejercicios</h1>
                <p className="text-gray-400 mt-1">Administra tus ejercicios</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 focus:outline-none shadow-lg transition-colors text-white font-medium cursor-pointer"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Añadir Ejercicio
            </button>
          </div>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="Buscar ejercicios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {filteredExercises.length === 0 ? (
            <div className="bg-gray-900 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">No se encontraron ejercicios. ¡Haz clic en el botón "Añadir Ejercicio" para comenzar!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExercises.map(exercise => (
                <ExerciseCard 
                  key={exercise.id} 
                  exercise={exercise} 
                  onRefetch={handleRefetchExercises}
                  layout="vertical"
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Exercise Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-auto overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h3 className="text-xl font-medium text-white">Crear Nuevo Ejercicio</h3>
              <button 
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    Nombre del Ejercicio
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ingresa el nombre del ejercicio"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ingresa la descripción del ejercicio"
                    required
                  ></textarea>
                </div>
                
                <div>
                  <label htmlFor="video" className="block text-sm font-medium text-gray-300 mb-1">
                    Video (MP4)
                  </label>
                  <div className="flex items-center mt-1">
                    <input
                      type="file"
                      id="video"
                      ref={videoInputRef}
                      accept="video/mp4"
                      onChange={handleVideoChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:content-['Elegir_archivo']"
                      required
                    />
                  </div>
                  {videoFile && (
                    <p className="mt-1 text-sm text-gray-400">Seleccionado: {videoFile.name}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="image" className="block text-sm font-medium text-gray-300 mb-1">
                    Imagen de Miniatura
                  </label>
                  <div className="flex items-center mt-1">
                    <input
                      type="file"
                      id="image"
                      ref={imageInputRef}
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:content-['Elegir_archivo']"
                      required
                    />
                  </div>
                  {imageFile && (
                    <p className="mt-1 text-sm text-gray-400">Seleccionado: {imageFile.name}</p>
                  )}
                </div>
              </div>
              
              {formError && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-md">
                  <p className="text-sm text-red-300">{formError}</p>
                </div>
              )}
              
              {isSubmitting && (
                <div className="mt-4">
                  <div className="w-full bg-gray-800 rounded-full h-2.5 mb-1">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400">Subiendo: {uploadProgress}%</p>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white mr-2"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm flex items-center ${
                    isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Subiendo...
                    </>
                  ) : (
                    'Crear Ejercicio'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 