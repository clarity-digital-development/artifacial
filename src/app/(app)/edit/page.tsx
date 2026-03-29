import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCharactersWithSignedUrls } from "@/lib/characters";
import { EditClient } from "./edit-client";

export default async function EditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const characters = await getCharactersWithSignedUrls(session.user.id);

  const characterData = characters.map((c) => ({
    id: c.id,
    name: c.name,
    signedUrls: c.signedUrls,
    referenceImages: c.referenceImages,
  }));

  return <div className="h-full"><EditClient characters={characterData} /></div>;
}
