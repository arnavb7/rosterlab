import { NextResponse } from "next/server";

import { usernameSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username") ?? "";
  if (!usernameSchema.safeParse(username).success) {
    return NextResponse.redirect(new URL("/?error=invalid", request.url));
  }
  return NextResponse.redirect(new URL(`/lookup/user/${username}`, request.url));
}
