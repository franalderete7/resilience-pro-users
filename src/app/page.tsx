'use client';

import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";

export default function Home() {
  const { user } = useAuth();

  console.log('🏠 Rendering Home Page:', {
    userId: user?.id,
  });

  return (
    <>
      <Header />
      <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-black">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Bienvenido a <span className="text-blue-500">ResiliencePro</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Tu compañero personal de entrenamiento para desarrollar fuerza y resiliencia.
          </p>
        </div>
      </main>
    </>
  );
}
