import { getServices } from "@/lib/data/users";
import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET() {
  const services = await getServices();
  return NextResponse.json(services);
}
