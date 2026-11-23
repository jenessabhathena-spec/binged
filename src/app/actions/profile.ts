"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, saveProfile } from "@/lib/auth";
import { profileInputFromForm, validateProfile, type ProfileErrors } from "@/lib/profile";

export type ProfileState = { errors?: ProfileErrors; formError?: string };

// Validation runs here on the server (the form's checks are only for speed). Email and photo are never read
// from the form: they come from Google.
export async function saveProfileAction(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const parsed = validateProfile(profileInputFromForm(fd));
  if (!parsed.ok) return { errors: parsed.errors };
  try {
    await saveProfile(user, parsed.value);
  } catch {
    return { formError: "Couldn't save your profile. Please try again." };
  }
  revalidatePath("/profile");
  revalidatePath("/home");
  revalidatePath("/preferences");
  redirect("/preferences");
}
