import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentMode, dateOfBirth } = await req.json();

  if (contentMode !== "SFW" && contentMode !== "NSFW") {
    return NextResponse.json({ error: "Invalid content mode" }, { status: 400 });
  }

  // Disabling NSFW — immediate, no verification needed
  if (contentMode === "SFW") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { contentMode: "SFW" },
    });
    return NextResponse.json({ contentMode: "SFW" });
  }

  // Enabling NSFW — check subscription tier first
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateOfBirth: true, subscriptionTier: true },
  });

  if (user?.subscriptionTier === "FREE") {
    return NextResponse.json(
      {
        error: "SUBSCRIPTION_REQUIRED",
        message: "Mature content requires a Starter plan or above.",
        requiredTier: "STARTER",
      },
      { status: 403 }
    );
  }

  // If already age-verified, just flip the mode
  if (user?.dateOfBirth) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { contentMode: "NSFW" },
    });
    return NextResponse.json({ contentMode: "NSFW" });
  }

  // First-time activation — DOB required
  if (!dateOfBirth) {
    return NextResponse.json(
      { error: "Date of birth is required for age verification" },
      { status: 400 }
    );
  }

  // Parse and validate DOB
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) {
    return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
  }

  // Reject future dates
  const now = new Date();
  if (dob > now) {
    return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
  }

  // Calculate age
  const age = getAge(dob, now);
  if (age < 18) {
    return NextResponse.json(
      { error: "You must be at least 18 years old to enable mature content" },
      { status: 403 }
    );
  }

  // Store DOB and enable NSFW
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      contentMode: "NSFW",
      dateOfBirth: dob,
    },
  });

  return NextResponse.json({ contentMode: "NSFW" });
}

function getAge(dob: Date, now: Date): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
