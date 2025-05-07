import { auth } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'

export default async function RootPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const fromLogout = searchParams.from === 'logout'
  
  if (fromLogout) {
    return redirect('/login')
  }
  
  const session = await auth()
  
  if (session) {
    return redirect('/home')
  } else {
    return redirect('/login')
  }

}