import { useState, useRef } from "react";
import Image from "next/image";
import VideoModal from "./VideoModal";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

// Profile type for creator information
interface Profile {
  uuid: string;
  name?: string;
  image?: string;
  email?: string;
}

export interface Exercise {
  id: number;
  name: string;
  description?: string;
  image?: string;
  video?: string;
  created_by?: string;
  creator?: Profile; // Creator profile information
}

interface ExerciseCardProps {
  exercise: Exercise;
  layout?: 'vertical' | 'horizontal';
  onRefetch?: () => void;
}

export default function ExerciseCard({ exercise, layout = 'horizontal', onRefetch }: ExerciseCardProps) {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: exercise.name,
    description: exercise.description || '',
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const router = useRouter();
  
  console.log('🎴 Rendering ExerciseCard:', { 
    exerciseId: exercise.id,
    name: exercise.name,
    hasCreator: !!exercise.creator
  });
  
  // Creator avatar component
  const CreatorAvatar = () => {
    // Get the creator display name, preferring name → email → uuid
    const creatorName = exercise.creator?.name || exercise.creator?.email || exercise.created_by || 'Unknown';
    
    // Get the initial letter for the avatar fallback
    const initial = ((creatorName && creatorName.charAt(0)) || '?').toUpperCase();
    
    // Check if we have a valid creator image
    const hasCreatorImage = Boolean(exercise.creator?.image && typeof exercise.creator.image === 'string' && exercise.creator.image.startsWith('http'));
    
    return (
      <div className="mt-2 flex items-center" data-testid="creator-avatar">
        <span className="text-xs text-gray-400 mr-2">Creado por:</span>
        <div className="group relative inline-block">
          <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-700 bg-gray-800 flex items-center justify-center hover:border-blue-500 transition-colors cursor-pointer">
            {hasCreatorImage ? (
              <Image 
                src={exercise.creator!.image!}
                alt={creatorName}
                width={24}
                height={24}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-blue-900 text-white text-xs font-bold">
                {initial}
              </div>
            )}
          </div>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 bg-gray-800 text-white text-xs py-1 px-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none whitespace-nowrap">
            {creatorName}
          </div>
        </div>
      </div>
    );
  };
  
  const handleOpenVideo = (e: React.MouseEvent) => {
    e.preventDefault();
    if (exercise.video) {
      setIsVideoModalOpen(true);
    }
  };

  const handleEditClick = () => {
    setEditForm({
      name: exercise.name,
      description: exercise.description || '',
    });
    setVideoFile(null);
    setImageFile(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    setIsEditModalOpen(true);
  };
  
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'video/mp4') {
        alert('Por favor, sube un archivo de video MP4');
        return;
      }
      setVideoFile(file);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert('Por favor, sube un archivo de imagen válido');
        return;
      }
      setImageFile(file);
    }
  };
  
  const handleEditSubmit = async () => {
    try {
      setIsSubmitting(true);
      const supabase = createClientComponentClient();
      
      // Create update object
      const updateData: any = {
        name: editForm.name,
        description: editForm.description,
      };
      
      // Upload new video if provided
      if (videoFile) {
        // Generate unique filename
        const timestamp = Date.now();
        const videoFileName = `${timestamp}_${videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        
        const { data: videoData, error: videoError } = await supabase.storage
          .from('exercises')
          .upload(`videos/${videoFileName}`, videoFile, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (videoError) throw new Error(`Error al subir el video: ${videoError.message}`);
        
        // Get public URL
        const videoUrl = supabase.storage
          .from('exercises')
          .getPublicUrl(`videos/${videoFileName}`).data.publicUrl;
          
        updateData.video = videoUrl;
      }
      
      // Upload new image if provided
      if (imageFile) {
        // Generate unique filename
        const timestamp = Date.now();
        const imageFileName = `${timestamp}_${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        
        const { data: imageData, error: imageError } = await supabase.storage
          .from('exercises')
          .upload(`images/${imageFileName}`, imageFile, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (imageError) throw new Error(`Error al subir la imagen: ${imageError.message}`);
        
        // Get public URL
        const imageUrl = supabase.storage
          .from('exercises')
          .getPublicUrl(`images/${imageFileName}`).data.publicUrl;
          
        updateData.image = imageUrl;
      }
      
      // Update exercise in database
      const { error } = await supabase
        .from('exercises')
        .update(updateData)
        .eq('id', exercise.id);

      if (error) throw new Error(`Error al actualizar ejercicio: ${error.message}`);
      
      setIsEditModalOpen(false);
      if (onRefetch) onRefetch();
      
    } catch (err) {
      console.error('Error updating exercise:', err);
      alert(err instanceof Error ? err.message : 'Ha ocurrido un error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm({
      ...editForm,
      [name]: value
    });
  };

  const handleDeleteExercise = async () => {
    if (confirm('¿Estás seguro de que quieres eliminar este ejercicio?')) {
      try {
        const supabase = createClientComponentClient();
        const { error } = await supabase
          .from('exercises')
          .delete()
          .eq('id', exercise.id);

        if (error) throw new Error(`Error al eliminar ejercicio: ${error.message}`);

        if (onRefetch) {
          onRefetch();
        } else {
          router.push('/exercises');
        }
      } catch (err) {
        console.error('Error deleting exercise:', err);
        alert(err instanceof Error ? err.message : 'Ha ocurrido un error inesperado');
      }
    }
  };

  if (layout === 'horizontal') {
    return (
      <>
        <div 
          className="flex border border-gray-700 bg-gray-900 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden relative"
        >
          <div className="w-1/3 max-w-[200px] relative">
            {exercise.image ? (
              <Image 
                src={exercise.image}
                alt={exercise.name}
                width={200}
                height={150}
                className="object-cover h-full w-full"
              />
            ) : (
              <div className="bg-gray-800 h-full w-full flex items-center justify-center">
                <span className="text-gray-400">Sin imagen</span>
              </div>
            )}
          </div>
          <div className="p-6 flex-1">
            <h2 className="text-xl font-semibold mb-2 text-white">{exercise.name}</h2>
            {exercise.description && (
              <p className="text-gray-300 mb-2">{exercise.description}</p>
            )}
            <CreatorAvatar />
            <div className="mt-2 space-y-4">
              {exercise.video && (
                <button 
                  onClick={handleOpenVideo}
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors mb-2 cursor-pointer"
                >
                  <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path>
                  </svg>
                  Ver Video
                </button>
              )}
              <div className="flex space-x-4">
                <button 
                  onClick={handleEditClick}
                  className="edit-button flex-1 inline-flex items-center justify-center px-4 py-2 text-white rounded-md transition-colors cursor-pointer"
                  style={{ color: 'white' }}
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Editar
                </button>
                <button 
                  onClick={handleDeleteExercise}
                  className="delete-button flex-1 inline-flex items-center justify-center px-4 py-2 text-red-500 rounded-md transition-colors cursor-pointer"
                  style={{ color: '#ef4444' }}
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ color: '#ef4444' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {exercise.video && (
          <VideoModal
            videoUrl={exercise.video}
            isOpen={isVideoModalOpen}
            onClose={() => setIsVideoModalOpen(false)}
            title={`${exercise.name} - Video`}
          />
        )}
        
        {/* Edit Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-auto overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-800">
                <h3 className="text-xl font-medium text-white">Editar Ejercicio</h3>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                      Nombre del Ejercicio
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={editForm.name}
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
                      value={editForm.description}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ingresa la descripción del ejercicio"
                    ></textarea>
                  </div>
                  
                  <div>
                    <label htmlFor="video" className="block text-sm font-medium text-gray-300 mb-1">
                      Video (MP4) - Dejar vacío para mantener el video actual
                    </label>
                    <div className="flex items-center mt-1">
                      <input
                        type="file"
                        id="video"
                        ref={videoInputRef}
                        accept="video/mp4"
                        onChange={handleVideoChange}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:content-['Elegir_archivo']"
                      />
                    </div>
                    {exercise.video && !videoFile && (
                      <p className="mt-1 text-sm text-gray-400">Actual: {exercise.video.split('/').pop()}</p>
                    )}
                    {videoFile && (
                      <p className="mt-1 text-sm text-gray-400">Seleccionado: {videoFile.name}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="image" className="block text-sm font-medium text-gray-300 mb-1">
                      Imagen de Miniatura - Dejar vacío para mantener la imagen actual
                    </label>
                    <div className="flex items-center mt-1">
                      <input
                        type="file"
                        id="image"
                        ref={imageInputRef}
                        accept="image/*"
                        onChange={handleImageChange}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:content-['Elegir_archivo']"
                      />
                    </div>
                    {exercise.image && !imageFile && (
                      <p className="mt-1 text-sm text-gray-400">Actual: {exercise.image.split('/').pop()}</p>
                    )}
                    {imageFile && (
                      <p className="mt-1 text-sm text-gray-400">Seleccionado: {imageFile.name}</p>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white mr-2 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSubmit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm flex items-center cursor-pointer"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Guardando...
                      </>
                    ) : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  
  // Vertical layout
  return (
    <>
      <div className="border border-gray-700 bg-gray-900 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow relative">
        <h2 className="text-xl font-semibold mb-4 text-white">{exercise.name}</h2>
        {exercise.image && (
          <div className="mb-4 w-full h-48 relative rounded-md overflow-hidden">
            <Image 
              src={exercise.image}
              alt={exercise.name}
              fill
              className="object-cover"
            />
          </div>
        )}
        {exercise.description && (
          <p className="text-gray-600 dark:text-gray-300 mb-4">{exercise.description}</p>
        )}
        <CreatorAvatar />
        <div className="flex flex-col space-y-4 mt-4">
          {exercise.video && (
            <button 
              onClick={handleOpenVideo}
              className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors mb-2 cursor-pointer"
            >
              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path>
              </svg>
              Ver Video
            </button>
          )}
          <div className="flex space-x-4">
            <button 
              onClick={handleEditClick}
              className="edit-button flex-1 inline-flex items-center justify-center px-4 py-2 text-white rounded-md transition-colors cursor-pointer"
              style={{ color: 'white' }}
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Editar
            </button>
            <button 
              onClick={handleDeleteExercise}
              className="delete-button flex-1 inline-flex items-center justify-center px-4 py-2 text-red-500 rounded-md transition-colors cursor-pointer"
              style={{ color: '#ef4444' }}
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ color: '#ef4444' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </button>
          </div>
        </div>
      </div>
      
      {exercise.video && (
        <VideoModal
          videoUrl={exercise.video}
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          title={`${exercise.name} - Video`}
        />
      )}
      
      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-auto overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h3 className="text-xl font-medium text-white">Editar Ejercicio</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    Nombre del Ejercicio
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={editForm.name}
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
                    value={editForm.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ingresa la descripción del ejercicio"
                  ></textarea>
                </div>
                
                <div>
                  <label htmlFor="video" className="block text-sm font-medium text-gray-300 mb-1">
                    Video (MP4) - Dejar vacío para mantener el video actual
                  </label>
                  <div className="flex items-center mt-1">
                    <input
                      type="file"
                      id="video"
                      ref={videoInputRef}
                      accept="video/mp4"
                      onChange={handleVideoChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:content-['Elegir_archivo']"
                    />
                  </div>
                  {exercise.video && !videoFile && (
                    <p className="mt-1 text-sm text-gray-400">Actual: {exercise.video.split('/').pop()}</p>
                  )}
                  {videoFile && (
                    <p className="mt-1 text-sm text-gray-400">Seleccionado: {videoFile.name}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="image" className="block text-sm font-medium text-gray-300 mb-1">
                    Imagen de Miniatura - Dejar vacío para mantener la imagen actual
                  </label>
                  <div className="flex items-center mt-1">
                    <input
                      type="file"
                      id="image"
                      ref={imageInputRef}
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:content-['Elegir_archivo']"
                    />
                  </div>
                  {exercise.image && !imageFile && (
                    <p className="mt-1 text-sm text-gray-400">Actual: {exercise.image.split('/').pop()}</p>
                  )}
                  {imageFile && (
                    <p className="mt-1 text-sm text-gray-400">Seleccionado: {imageFile.name}</p>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white mr-2 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEditSubmit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm flex items-center cursor-pointer"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 