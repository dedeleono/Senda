import React from 'react'
import { Wallet, ArrowUp, Plus } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4">
        <div className="bg-gray-200 animate-pulse h-10 w-[150px] rounded-md" />

        <div className="flex items-center gap-2 mr-5">
          <div className="bg-gray-200 animate-pulse h-9 w-9 rounded-full" />
          <div className="bg-gray-200 animate-pulse h-9 w-9 rounded-md" />
        </div>
      </header>

      <div className="flex flex-col min-h-full mx-auto md:flex-row md:max-w-3xl">
        <main className="flex-1 p-6 space-y-6">
          <div className="bg-gray-200 animate-pulse rounded-2xl shadow-md h-[200px]" />

          <div className="bg-white rounded-2xl shadow-md">
            <div className="w-full grid grid-cols-3 border-b-2 border-gray-400/5 h-14">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-center">
                  <div className="bg-gray-200 animate-pulse h-5 w-24 rounded-md" />
                </div>
              ))}
            </div>
            
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="bg-gray-200 animate-pulse h-12 w-12 rounded-lg mb-6" />
              <div className="bg-gray-200 animate-pulse h-6 w-64 rounded-md mb-2" />
              <div className="bg-gray-200 animate-pulse h-4 w-48 rounded-md mb-6" />
              <div className="bg-gray-200 animate-pulse h-10 w-36 rounded-md" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
