import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Public routes that bypass authentication
  const isPublicRoute = 
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/health' ||
    pathname.startsWith('/_next/') ||
    (!pathname.startsWith('/api/') && pathname.includes('.')) // safely allow public assets (e.g. .svg) but never bypass /api/ routes

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Get session
  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(
    request,
    res,
    sessionOptions
  )
  
  if (!session.user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    } else {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
