import { WorkshopClient } from "./workshop-client";

export const metadata = {
  title: "Workshop — Artifacial",
};

export default async function WorkshopPage() {
  // TODO: re-enable auth
  return <WorkshopClient totalCredits={0} />;
}
