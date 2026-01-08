import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function POST(req: Request) {
  const { roomId, userEmail } = await req.json();
  console.log("REQ:BODY : ",{roomId,userEmail});
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    {
      identity: userEmail,
    }
  );

  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const jwt = await at.toJwt(); 

  console.log("JWT STRING:", jwt);
  console.log("JWT TYPE:", typeof jwt);

  return NextResponse.json({
    token: jwt, // ✅ STRING ONLY
    url: process.env.LIVEKIT_URL,
  });
}
