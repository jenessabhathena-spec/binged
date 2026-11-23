"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, savePreferences } from "@/lib/auth";
import { parsePreferences, type PreferencesErrors } from "@/lib/preferences";

export type PreferencesState = { errors?: PreferencesErrors; formError?: string };

// Validated on the server; every question may be left blank. The budget is read here and stored for its
// owner only. It is never logged and never echoed back in the response.
export async function savePreferencesAction(_prev: PreferencesState, fd: FormData): Promise<PreferencesState> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const parsed = parsePreferences(fd);
  if (!parsed.ok) return { errors: parsed.errors };
  try {
    await savePreferences(user, parsed.value);
  } catch {
    return { formError: "Couldn't save your preferences. Please try again." };
  }
  // Pages visited earlier are kept for fast back-navigation: refresh them so the form and summary show what was just saved.
  revalidatePath("/preferences");
  revalidatePath("/home");
  redirect("/home");
}
