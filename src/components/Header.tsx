'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close the dropdown when changing routes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Close dropdown immediately for better UX
    setIsOpen(false);
    console.log('Header - Sign out button clicked');
    
    try {
      // Add a visual indication that sign-out is in progress (optional)
      const signOutBtn = e.currentTarget as HTMLButtonElement;
      if (signOutBtn) {
        signOutBtn.disabled = true;
        signOutBtn.textContent = 'Cerrando sesión...';
      }
      
      // Call the signOut function from AuthContext
      await signOut();
    } catch (error) {
      console.error('Header - Error during sign out:', error);
      // Fallback to direct navigation if signOut throws
      window.location.href = '/login';
    }
  };

  return (
    <header className="bg-black shadow-lg py-6">
      <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center -ml-2">
            <Link href="/" className="text-2xl font-bold text-white">
              ResiliencePro
            </Link>
          </div>
          
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-800 focus:outline-none"
                aria-expanded={isOpen}
                aria-haspopup="true"
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-black border border-gray-800 rounded-lg shadow-xl z-10 origin-top-right transform">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-sm text-gray-400">Sesión iniciada como</p>
                    <p className="text-sm font-medium text-white truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link 
                      href="/" 
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Inicio
                    </Link>
                    <Link 
                      href="/profile" 
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      Perfil
                    </Link>
                    <Link 
                      href="/exercises" 
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Ejercicios
                    </Link>
                    <Link 
                      href="/workouts" 
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Rutinas
                    </Link>
                    <Link 
                      href="/users" 
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Usuarios
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300"
                    >
                      <span className="ml-6">Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 