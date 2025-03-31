'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient, SupabaseClient, User } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  supabase: SupabaseClient;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    console.log('🔄 AuthProvider - Initializing');
    
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📱 AuthProvider - Initial session check:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      });
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 AuthProvider - Auth state changed:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      });
      
      // Update user state with the current session
      setUser(session?.user ?? null);
      setLoading(false);

      // Don't handle navigation here - we'll let the signOut function handle it
      // This prevents conflicts in navigation
    });

    return () => {
      console.log('🧹 AuthProvider - Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  // Separate useEffect for profile management
  useEffect(() => {
    // Only run when we have a logged-in user
    if (user) {
      console.log('👤 Profile Manager - Checking profile for user:', user.id);
      console.log('👤 Profile structure check:', {
        id: user.id,
        idType: typeof user.id,
        idLength: user.id?.length,
        email: user.email,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
        aud: user.aud,
        rawUserObject: JSON.stringify(user, null, 2)
      });
      
      // Use a ref to track if profile operation is in progress
      // This prevents multiple concurrent operations that could create duplicates
      let isProfileOperationInProgress = false;
      
      const handleUserProfile = async () => {
        // Exit early if operation already in progress
        if (isProfileOperationInProgress) {
          console.log('🔄 Profile Manager - Operation already in progress, skipping');
          return;
        }
        
        try {
          isProfileOperationInProgress = true;
          
          // First try to get all profiles for this user to check for duplicates
          const { data: allUserProfiles, error: listError } = await supabase
            .from('profiles')
            .select('*')
            .eq('uuid', user.id);
          
          if (listError) {
            console.error('❌ Profile Manager - Error listing profiles:', listError);
            return;
          }
          
          console.log(`👤 Profile Manager - Found ${allUserProfiles?.length || 0} profiles for user:`, user.id);
          
          // If multiple profiles exist, keep only the oldest one and delete the rest
          if (allUserProfiles && allUserProfiles.length > 1) {
            console.log('⚠️ Profile Manager - Multiple profiles detected, cleaning up...');
            
            // Sort by created_at (assuming profiles table has this column)
            // If not, we can use the ID which usually auto-increments
            const sortedProfiles = [...allUserProfiles].sort((a, b) => {
              // If created_at exists, use it
              if (a.created_at && b.created_at) {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              }
              // Otherwise fall back to ID
              return a.id - b.id;
            });
            
            // Keep the oldest profile
            const oldestProfile = sortedProfiles[0];
            
            // Delete all other profiles
            for (let i = 1; i < sortedProfiles.length; i++) {
              const profileToDelete = sortedProfiles[i];
              console.log(`🗑️ Profile Manager - Deleting duplicate profile ID:`, profileToDelete.id);
              
              await supabase
                .from('profiles')
                .delete()
                .eq('id', profileToDelete.id);
            }
            
            // Update the last_sign_in_at of the oldest profile
            console.log('🔄 Profile Manager - Updating oldest profile');
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ last_sign_in_at: new Date().toISOString() })
              .eq('id', oldestProfile.id);
            
            if (updateError) {
              console.error('❌ Profile Manager - Failed to update profile:', updateError);
            } else {
              console.log('✅ Profile Manager - Profile updated successfully');
            }
            
            return;
          }
          
          // Regular flow for when 0 or 1 profiles exist
          if (!allUserProfiles || allUserProfiles.length === 0) {
            // First double-check with a direct uuid check to avoid race conditions
            const { data: doubleCheck, error: doubleCheckError } = await supabase
              .from('profiles')
              .select('uuid')
              .eq('uuid', user.id)
              .maybeSingle(); // Use maybeSingle to avoid errors if no record found
              
            if (doubleCheckError) {
              console.error('❌ Profile Manager - Error double-checking profile:', doubleCheckError);
            }
            
            // If double-check found a record, skip creation
            if (doubleCheck) {
              console.log('⚠️ Profile Manager - Record found in double-check, skipping creation');
              
              // Extract name from user metadata
              const userName = user.user_metadata?.full_name || 
                               user.user_metadata?.name || 
                               user.user_metadata?.displayName || 
                               user.user_metadata?.display_name || 
                               (user.email ? user.email.split('@')[0] : null);
              
              // Check if the existing profile has a name and roles
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('name, roles')
                .eq('uuid', user.id)
                .single();
              
              // Prepare update data
              const updateData: any = { 
                last_sign_in_at: new Date().toISOString() 
              };
              
              // Only add name if existing profile has no name
              if (userName && !currentProfile?.name) {
                updateData.name = userName;
                console.log('✏️ Profile Manager - Updating missing name in double-check flow:', userName);
              }
              
              // Add 'trainer' role if roles is null or doesn't include 'trainer'
              if (!currentProfile?.roles || !Array.isArray(currentProfile.roles) || !currentProfile.roles.includes('trainer')) {
                updateData.roles = currentProfile?.roles && Array.isArray(currentProfile.roles) 
                  ? [...currentProfile.roles, 'trainer'] 
                  : ['trainer'];
                console.log('🔑 Profile Manager - Adding trainer role in double-check flow');
              }
              
              // Update the profile
              const { error: updateError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('uuid', user.id);
                
              if (updateError) {
                console.error('❌ Profile Manager - Failed to update profile:', updateError);
              } else {
                console.log('✅ Profile Manager - Profile updated successfully');
              }
              
              return;
            }
            
            // No profile exists, create new one
            console.log('➕ Profile Manager - Creating new profile');
            
            // Extract name from various possible sources in user_metadata
            const userName = user.user_metadata?.full_name || 
                             user.user_metadata?.name || 
                             user.user_metadata?.displayName || 
                             user.user_metadata?.display_name || 
                             (user.email ? user.email.split('@')[0] : null);
            
            console.log('👤 Profile Manager - Extracted user name:', userName);
            
            // The uuid field is now a UUID in the database
            const profileData = {
              uuid: user.id, // user.id is a UUID from auth.users
              email: user.email,
              name: userName, // Add name from user metadata
              phone: user.phone || null,
              providers: [user.app_metadata?.provider || 'google'],
              provider_type: user.app_metadata?.provider || 'google',
              image: user.user_metadata?.avatar_url || null,
              last_sign_in_at: new Date().toISOString(),
              roles: ['trainer'] // Add the 'trainer' role to the roles array
            };
            
            console.log('📋 Profile Manager - Profile data to insert:', JSON.stringify(profileData, null, 2));
            console.log('🔍 Profile Manager - uuid data type check:', {
              uuid: user.id,
              type: typeof user.id,
              length: user.id.length
            });
            
            try {
              // Use upsert instead of insert to handle the case where a profile already exists
              // This will insert if the record doesn't exist, or update if it does
              const { data: upsertData, error: upsertError } = await supabase
                .from('profiles')
                .upsert(profileData, {
                  onConflict: 'uuid',
                  ignoreDuplicates: false
                })
                .select();
              
              if (upsertError) {
                console.error('❌ Profile Manager - Upsert failed:', upsertError);
                console.error('Error details:', {
                  message: upsertError.message,
                  code: upsertError.code,
                  details: upsertError.details,
                  hint: upsertError.hint
                });
              } else {
                console.log('✅ Profile Manager - Profile created or updated successfully:', upsertData);
              }
            } catch (err) {
              console.error('❌ Profile Manager - Unexpected error during profile creation:', err);
            }
          } else {
            // Exactly one profile exists, update last_sign_in_at
            console.log('🔄 Profile Manager - Updating existing profile');
            
            // Extract name from user metadata for existing profile updates too
            const userName = user.user_metadata?.full_name || 
                             user.user_metadata?.name || 
                             user.user_metadata?.displayName || 
                             user.user_metadata?.display_name || 
                             (user.email ? user.email.split('@')[0] : null);
            
            // Update both last_sign_in_at and name if available
            const updateData: any = { 
              last_sign_in_at: new Date().toISOString() 
            };
            
            // Only update name if it exists and the current profile's name is empty/null
            if (userName) {
              // First check if the current profile has a name
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('name, roles')
                .eq('uuid', user.id)
                .single();
                
              // Update name only if current profile has no name
              if (!currentProfile?.name) {
                updateData.name = userName;
                console.log('✏️ Profile Manager - Updating missing name to:', userName);
              }
              
              // Add 'trainer' role if roles is null or doesn't include 'trainer'
              if (!currentProfile?.roles || !Array.isArray(currentProfile.roles) || !currentProfile.roles.includes('trainer')) {
                updateData.roles = currentProfile?.roles && Array.isArray(currentProfile.roles) 
                  ? [...currentProfile.roles, 'trainer'] 
                  : ['trainer'];
                console.log('🔑 Profile Manager - Adding trainer role to existing profile');
              }
            }
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update(updateData)
              .eq('uuid', user.id);
            
            if (updateError) {
              console.error('❌ Profile Manager - Failed to update profile:', updateError);
            } else {
              console.log('✅ Profile Manager - Profile updated successfully');
            }
          }
        } catch (error) {
          // Contain any errors within this effect
          console.error('❌ Profile Manager - Unexpected error:', error);
        } finally {
          isProfileOperationInProgress = false;
        }
      };
      
      // Execute the profile handling function
      handleUserProfile();
    }
  }, [user, supabase]);

  const signInWithGoogle = async () => {
    console.log('🔑 AuthProvider - Starting Google sign in');
    try {
      // Always use the current origin in browser environments
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : '/auth/callback'; // Fallback, should not reach this in browser
        
      console.log('🔗 AuthProvider - Using redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ AuthProvider - Google sign in error:', error);
        throw error;
      }

      console.log('✅ AuthProvider - Google sign in initiated:', data);
    } catch (error) {
      console.error('❌ AuthProvider - Unexpected error during Google sign in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    console.log('🔑 AuthProvider - Starting sign out');
    
    try {
      // Clear local state first
      setUser(null);
      
      try {
        // Call our server-side signout endpoint first (most reliable)
        const response = await fetch('/api/auth/signout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          console.log('✅ AuthProvider - Server-side sign out successful');
        } else {
          console.warn('⚠️ AuthProvider - Server-side sign out returned non-200 status:', response.status);
        }
        
        // Also call client-side signout as backup
        await supabase.auth.signOut();
        console.log('✅ AuthProvider - Client-side sign out called');
      } catch (err) {
        console.error('❌ AuthProvider - Error during sign out process:', err);
        // Continue with redirect even if there was an error
      }
      
      // Force navigation to login page
      console.log('🔄 AuthProvider - Forcing navigation to /login');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('❌ AuthProvider - Unexpected error in signOut function:', error);
      // Final fallback
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const createOrUpdateUserRecord = async (authUser: User) => {
    if (!authUser) {
      console.error('No auth user provided');
      return;
    }

    try {
      console.log('🔍 Starting createOrUpdateUserRecord with user:', {
        id: authUser.id,
        email: authUser.email,
        metadata: authUser.user_metadata
      });

      // Check if user exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('uuid')
        .eq('uuid', authUser.id)
        .single();

      console.log('🔍 Check for existing user:', {
        exists: !!existingUser,
        error: checkError?.message
      });

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing user:', checkError);
        return;
      }

      // Extract name from various possible sources in user_metadata using the same logic
      const userName = authUser.user_metadata?.full_name || 
                       authUser.user_metadata?.name || 
                       authUser.user_metadata?.displayName || 
                       authUser.user_metadata?.display_name || 
                       (authUser.email ? authUser.email.split('@')[0] : '');

      const newUserData = {
        uuid: authUser.id,
        email: authUser.email,
        name: userName,
        image: authUser.user_metadata?.avatar_url || null,
        phone: authUser.user_metadata?.phone || null,
        providers: authUser.app_metadata?.providers || [],
        provider_type: authUser.app_metadata?.provider || null,
        last_sign_in_at: new Date().toISOString(),
        roles: ['trainer'] // Add the 'trainer' role to the roles array
      };

      console.log('📝 New user data to be inserted:', newUserData);

      if (!existingUser) {
        // Create new user record
        const { error: insertError } = await supabase
          .from('users')
          .insert([newUserData]);

        if (insertError) {
          console.error('Error inserting new user:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code
          });
          return;
        }

        console.log('✅ New user record created successfully');
      } else {
        // Get current user data to check roles
        const { data: currentUser, error: fetchError } = await supabase
          .from('users')
          .select('roles')
          .eq('uuid', authUser.id)
          .single();
          
        if (fetchError) {
          console.error('Error fetching current user data:', fetchError);
        }
        
        // Prepare update data
        const updateData: any = { 
          last_sign_in_at: new Date().toISOString() 
        };
        
        // Add 'trainer' role if roles is null or doesn't include 'trainer'
        if (!currentUser?.roles || !Array.isArray(currentUser.roles) || !currentUser.roles.includes('trainer')) {
          updateData.roles = currentUser?.roles && Array.isArray(currentUser.roles) 
            ? [...currentUser.roles, 'trainer'] 
            : ['trainer'];
          console.log('🔑 Adding trainer role to existing user record');
        }
        
        // Update user record
        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('uuid', authUser.id);

        if (updateError) {
          console.error('Error updating user record:', updateError);
          return;
        }

        console.log('✅ Updated existing user record');
      }
    } catch (error) {
      console.error('Error in createOrUpdateUserRecord:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, supabase, signInWithGoogle, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 