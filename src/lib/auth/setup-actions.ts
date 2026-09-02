"use server";

import {
  createFirstAdmin,
  setupSchema,
  SetupTokenInvalidError,
  SetupUnavailableError,
} from "@/lib/auth/setup";

export async function createFirstAdminAction(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const parsed = setupSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  try {
    await createFirstAdmin(parsed.data);
  } catch (error) {
    if (error instanceof SetupTokenInvalidError) {
      return { error: "Invalid setup token." };
    }
    if (error instanceof SetupUnavailableError) {
      return { error: "Setup is no longer available." };
    }
    throw error;
  }

  return { success: true };
}
