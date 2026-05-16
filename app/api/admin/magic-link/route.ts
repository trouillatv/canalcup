import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

  const adminClient = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL!;

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Use hashed_token directly — bypasses Supabase /auth/v1/verify redirect
  // so hash-callback receives token_hash as a plain query param
  const token_hash = data?.properties?.hashed_token;

  return NextResponse.json({
    link: `${origin}/auth/hash-callback?token_hash=${token_hash}&type=magiclink`,
  });
}
