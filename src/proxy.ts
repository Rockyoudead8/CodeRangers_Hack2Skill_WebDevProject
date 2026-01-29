// import { NextResponse } from 'next/server'
// import type { NextRequest } from 'next/server'
 
// // This function can be marked `async` if using `await` inside
// export function proxy(request: NextRequest) {
//   const path= request.nextUrl.pathname;

//   const isPublicPath = path==='/login' || path==='/signup';

//   const token= request.cookies.get('accessToken')?.value || "";

//   if(isPublicPath && token){
//     return NextResponse.redirect(new URL('/',request.nextUrl));
//   }

//   if(!isPublicPath && !token){
//     return NextResponse.redirect(new URL('/login',request.nextUrl));
//   }

// }
 
// // See "Matching Paths" below to learn more
// //middleware wiil run while going befor to all this route
// export const config = {
//   matcher: [
//     '/',
//     '/profile/:name*',//for dynamic route
//     '/login',
//     '/signup',
//   ]
// }

