import { getRevivezPosts } from "@/lib/data/content";
import { RevivezClientPage } from "./client";

export const revalidate = 60;

export default async function RevivezPage() {
  const posts = await getRevivezPosts();
  return <RevivezClientPage initialPosts={posts} />;
}
