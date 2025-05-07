'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import React from 'react'

import { useAuth } from '@/hooks/use-auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AvatarImage } from '@radix-ui/react-avatar'
import { LogOut } from 'lucide-react'
import { useSignOut } from '@/hooks/use-sign-out'

export default function DashboardLayout() {
  const { session } = useAuth()
  const handleSignOut = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar className="h-9 w-9 cursor-pointer">
          <AvatarImage src={session?.user?.image as string} alt="User Avatar" />
          <AvatarFallback>{session?.user.email?.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 mr-9">
        <DropdownMenuLabel className="text-center">
          <div className="text-sm font-bold">{session?.user.name || session?.user?.email?.split('@')[0]}</div>
          <div className="text-xs text-muted-foreground">{session?.user.email}</div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer group p-0">
          <div className='group-hover:bg-red-100 rounded-sm flex items-center gap-2 w-full p-3'>
            <LogOut className="group-hover:text-red-600" />
          <span className='group-hover:text-red-600'>Log Out</span></div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
