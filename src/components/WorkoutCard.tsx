import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Workout } from "@/hooks/useWorkouts";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

interface WorkoutCardProps {
  workout: Workout;
  onDelete?: (workoutId: number) => void; // For immediate UI updates
  refreshWorkouts?: () => void; // Optional function to refresh data from API
  isTrainer?: boolean; // Whether the current user is a trainer
}

export default function WorkoutCard({ workout, onDelete, refreshWorkouts, isTrainer = true }: WorkoutCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Creator avatar component
  const CreatorAvatar = () => {
    // Get the creator display name, preferring name → email → uuid
    const creatorName = workout.creator?.name || workout.creator?.email || workout.created_by || 'Unknown';
    
    // Get the initial letter for the avatar fallback
    const initial = ((creatorName && creatorName.charAt(0)) || '?').toUpperCase();
    
    // Check if we have a valid creator image
    const hasCreatorImage = Boolean(workout.creator?.image && typeof workout.creator.image === 'string' && workout.creator.image.startsWith('http'));
    
    return (
      <div className="mt-2 flex items-center" data-testid="creator-avatar">
        <span className="text-xs text-gray-400 mr-2">Creado por:</span>
        <div className="group relative inline-block">
          <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-700 bg-gray-800 flex items-center justify-center hover:border-blue-500 transition-colors cursor-pointer">
            {hasCreatorImage ? (
              <Image 
                src={workout.creator!.image!}
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
  
  const handleDeleteWorkout = async () => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${workout.name}"?`)) {
      try {
        setIsDeleting(true);
        const supabase = createClientComponentClient();
        
        // First delete any associated blocks
        if (workout.blocks && workout.blocks.length > 0) {
          const blockIds = workout.blocks.map(block => block.id);
          await supabase.from('blocks').delete().in('id', blockIds);
        }
        
        // Then delete the workout
        const { error } = await supabase.from('workouts').delete().eq('id', workout.id);
        
        if (error) {
          throw error;
        }
        
        // Use callbacks for immediate UI updates
        if (onDelete) {
          onDelete(workout.id);
        }
        
        // If refreshWorkouts is provided, call it to refresh data from API
        if (refreshWorkouts) {
          refreshWorkouts();
        }
        
        // Only refresh router if there are no immediate update callbacks
        if (!onDelete && !refreshWorkouts) {
          router.refresh();
        }
        
      } catch (error) {
        console.error('Error deleting workout:', error);
        alert('Error al eliminar la rutina. Por favor, inténtalo de nuevo.');
      } finally {
        setIsDeleting(false);
      }
    }
  };
  
  return (
    <div className="border border-gray-700 bg-gray-900 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <h2 className="text-xl font-semibold text-white mb-2">{workout.name}</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-400">
          Creado: {formatDate(workout.created_at)}
        </p>
        <div className="mt-2 flex items-center">
          <svg className="w-4 h-4 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
          </svg>
          <span className="text-sm text-gray-400">
            {workout.blocks?.length || 0} {(workout.blocks?.length || 0) === 1 ? 'Bloque' : 'Bloques'}
          </span>
        </div>
        <CreatorAvatar />
      </div>
      
      <div className="flex flex-col space-y-3">
        <Link
          href={`/workouts/${workout.id}`}
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Ver Rutina
        </Link>

        {isTrainer && !workout.isAssigned && (
          <button 
            onClick={handleDeleteWorkout}
            disabled={isDeleting}
            className="delete-button inline-flex items-center justify-center px-4 py-2 text-red-500 rounded-md transition-colors cursor-pointer"
            style={{ color: '#ef4444' }}
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ color: '#ef4444' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        )}
      </div>
    </div>
  );
} 