'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

interface Profile {
  id: number;
  uuid: string;
  email: string;
  name?: string;
  image?: string;
  phone?: string;
  providers?: string[];
  provider_type?: string;
  last_sign_in_at?: string;
  height?: number;
  weight?: number;
  date_of_birth?: string;
  preferred_workout_time?: string[];
}

export default function ProfilePage() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [workoutTimeOptions] = useState([
    { value: 'morning', label: 'Mañana' },
    { value: 'afternoon', label: 'Tarde' },
    { value: 'evening', label: 'Noche' },
    { value: 'night', label: 'Madrugada' },
  ]);
  const [selectedWorkoutTimes, setSelectedWorkoutTimes] = useState<string[]>([]);

  // Fetch user profile
  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Debug RLS policies by checking if we can access profiles table
        try {
          const { data: testData, error: testError } = await supabase
            .from('profiles')
            .select('count(*)')
            .limit(1);
            
          console.log('🔍 Debug - Can access profiles table:', { success: !testError, error: testError?.message });
        } catch (e) {
          console.error('🔍 Debug - Error testing profiles access:', e);
        }
        
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('uuid', user.id)
          .single();
        
        if (error) {
          throw error;
        }
        
        // Get the profile image from data or from Google auth
        const profileImageUrl = data?.image || user.user_metadata?.avatar_url || null;
        
        setProfile(data);
        setName(data?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '');
        setImageUrl(profileImageUrl);
        setPhone(data?.phone || '');
        
        // Set new profile fields if they exist
        if (data.height) setHeight(data.height.toString());
        if (data.weight) setWeight(data.weight.toString());
        if (data.date_of_birth) setDateOfBirth(data.date_of_birth);
        if (data.preferred_workout_time) setSelectedWorkoutTimes(data.preferred_workout_time);
        
        // If user has a Google profile image but it's not saved in our profiles table, update it
        if (!data.image && user.user_metadata?.avatar_url) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ image: user.user_metadata.avatar_url })
            .eq('uuid', user.id);
            
          if (updateError) {
            console.error('Error updating profile with Google image:', updateError);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError('Error al cargar el perfil');
      } finally {
        setLoading(false);
      }
    }
    
    fetchProfile();
  }, [user, supabase]);

  // Handle file upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    try {
      setUploading(true);
      const file = event.target.files[0];
      
      // Upload image to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-profile')
        .upload(filePath, file);
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('user-profile')
        .getPublicUrl(filePath);
      
      const imageUrl = publicUrlData.publicUrl;
      
      // Update profile with new image URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ image: imageUrl })
        .eq('uuid', user?.id);
      
      if (updateError) {
        throw updateError;
      }
      
      setImageUrl(imageUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  // Handle name update
  const handleUpdateProfile = async () => {
    if (!user) return;
    
    try {
      setUpdating(true);
      
      console.log('Updating profile with name:', name);
      
      // Validate input values
      const heightValue = height ? parseFloat(height) : null;
      const weightValue = weight ? parseFloat(weight) : null;
      
      // Try using upsert instead of update (similar to what we did in AuthContext)
      const profileData = {
        uuid: user.id,
        name,
        phone: phone || null,
        // Include email to ensure upsert works properly
        email: profile?.email || user.email,
        // Add new profile fields
        height: heightValue,
        weight: weightValue,
        date_of_birth: dateOfBirth || null,
        preferred_workout_time: selectedWorkoutTimes.length > 0 ? selectedWorkoutTimes : null
      };
      
      console.log('Profile data for update:', profileData);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'uuid',
          ignoreDuplicates: false
        });
      
      if (updateError) {
        console.error('Update error details:', {
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint
        });
        throw updateError;
      }
      
      console.log('Profile updated successfully');
      setProfile(prev => prev ? { ...prev, name } : null);
      setError(null); // Clear any previous error
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Error al actualizar el perfil. Revisa la consola para más detalles.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle workout time selection
  const toggleWorkoutTime = (time: string) => {
    setSelectedWorkoutTimes(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      } else {
        return [...prev, time];
      }
    });
  };

  // Format date for display
  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return '';
    
    // If the date is already in YYYY-MM-DD format, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Otherwise, try to parse and format it
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '';
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

  return (
    <>
      <Header />
      <main className="min-h-screen p-8 bg-black">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Tu Perfil</h1>
          
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          <div className="bg-gray-900 rounded-lg p-8 shadow-lg border border-gray-800">
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-800 border-2 border-gray-700 mb-4">
                  {imageUrl ? (
                    <Image 
                      src={imageUrl}
                      alt="Foto de perfil"
                      fill
                      className="object-cover"
                      onError={(e) => {
                        console.error('Error loading image:', imageUrl);
                        // Fallback to placeholder if image fails to load
                        setImageUrl(null);
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <svg 
                        className="w-16 h-16 text-gray-500" 
                        fill="currentColor" 
                        viewBox="0 0 20 20" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </div>
                  )}
                </div>
                
                <label className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                  {uploading ? 'Subiendo...' : 'Cambiar Foto'}
                  <input 
                    type="file" 
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
              
              <div className="flex-1 space-y-6 w-full">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={profile?.email || ''}
                    disabled
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-not-allowed opacity-75"
                  />
                  <p className="mt-2 text-xs text-gray-500">El correo electrónico no se puede cambiar</p>
                </div>
                
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    placeholder="Ingresa tu nombre"
                  />
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    placeholder="Ingresa tu número de teléfono"
                  />
                </div>
                
                <div>
                  <label htmlFor="height" className="block text-sm font-medium text-gray-400 mb-2">
                    Altura (cm)
                  </label>
                  <input
                    type="number"
                    id="height"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    placeholder="Altura en centímetros"
                    min="0"
                    step="0.1"
                  />
                </div>
                
                <div>
                  <label htmlFor="weight" className="block text-sm font-medium text-gray-400 mb-2">
                    Peso (kg)
                  </label>
                  <input
                    type="number"
                    id="weight"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    placeholder="Peso en kilogramos"
                    min="0"
                    step="0.1"
                  />
                </div>
                
                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-400 mb-2">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    max={new Date().toISOString().split('T')[0]} // Set max as today
                  />
                </div>
                
                <div>
                  <p className="block text-sm font-medium text-gray-400 mb-2">
                    Horario Preferido para Entrenar
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {workoutTimeOptions.map((option) => (
                      <div key={option.value} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`workout-time-${option.value}`}
                          checked={selectedWorkoutTimes.includes(option.value)}
                          onChange={() => toggleWorkoutTime(option.value)}
                          className="w-4 h-4 mr-2 accent-blue-600"
                        />
                        <label htmlFor={`workout-time-${option.value}`} className="text-gray-300">
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4">
                  <button
                    onClick={handleUpdateProfile}
                    disabled={updating}
                    className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md cursor-pointer transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {updating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Actualizando...
                      </>
                    ) : (
                      'Guardar Cambios'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
} 