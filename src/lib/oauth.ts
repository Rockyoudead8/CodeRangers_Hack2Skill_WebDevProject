import {
  type Auth,
  type OAuthCredential,
  type UserCredential,
  fetchSignInMethodsForEmail,
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithPopup,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";

export type OAuthProviderName = "google" | "github";

const providerLabels: Record<OAuthProviderName, string> = {
  google: "Google",
  github: "GitHub",
};

const createProvider = (name: OAuthProviderName) => {
  if (name === "google") {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive.file");
    return provider;
  }

  const provider = new GithubAuthProvider();
  provider.addScope("read:user");
  provider.addScope("user:email");
  return provider;
};

const getCode = (error: unknown) =>
  typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";

const getEmail = (error: unknown) =>
  typeof error === "object" &&
  error &&
  "customData" in error &&
  typeof (error as { customData?: { email?: unknown } }).customData?.email ===
    "string"
    ? String((error as { customData: { email: string } }).customData.email)
    : "";

const getPendingCredential = (
  name: OAuthProviderName,
  error: unknown
): OAuthCredential | null =>
  name === "google"
    ? GoogleAuthProvider.credentialFromError(error as FirebaseError)
    : GithubAuthProvider.credentialFromError(error as FirebaseError);

const createAuthError = (code: string, message: string) =>
  Object.assign(new Error(message), { code });

const getExistingOAuthProvider = async (
  auth: Auth,
  email: string,
  attemptedProvider: OAuthProviderName
): Promise<OAuthProviderName | null> => {
  const methods = email ? await fetchSignInMethodsForEmail(auth, email) : [];

  if (methods.includes(GoogleAuthProvider.PROVIDER_ID)) return "google";
  if (methods.includes(GithubAuthProvider.PROVIDER_ID)) return "github";
  if (methods.includes("password")) return null;

  // Some Firebase projects hide sign-in methods for privacy. In that case,
  // trying the opposite OAuth provider is the only client-side way to complete
  // linking without asking for a password.
  return attemptedProvider === "github" ? "google" : "github";
};

export const signInWithOAuthProvider = async (
  auth: Auth,
  name: OAuthProviderName
): Promise<UserCredential> => {
  try {
    return await signInWithPopup(auth, createProvider(name));
  } catch (error) {
    if (getCode(error) !== "auth/account-exists-with-different-credential") {
      throw error;
    }

    const pendingCredential = getPendingCredential(name, error);
    if (!pendingCredential) throw error;

    const existingProvider = await getExistingOAuthProvider(
      auth,
      getEmail(error),
      name
    );

    if (!existingProvider) {
      throw createAuthError(
        "auth/link-with-password-required",
        "This email already uses password login. Log in with your password first, then connect this provider."
      );
    }

    const existingResult = await signInWithPopup(
      auth,
      createProvider(existingProvider)
    );

    await linkWithCredential(existingResult.user, pendingCredential);
    return existingResult;
  }
};

export const getOAuthErrorMessage = (
  error: unknown,
  provider: OAuthProviderName
) => {
  const code = getCode(error);

  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return `${providerLabels[provider]} sign-in was cancelled.`;
    case "auth/unauthorized-domain":
      return "This deployed domain is not authorized in Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "This email already uses another sign-in method. Log in with that method first.";
    case "auth/link-with-password-required":
      return error instanceof Error
        ? error.message
        : "Log in with your password first, then connect this provider.";
    case "auth/credential-already-in-use":
      return "This provider is already connected to another account.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return `${providerLabels[provider]} sign-in failed.`;
  }
};

export const saveGoogleDriveToken = (result: UserCredential) => {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (accessToken) localStorage.setItem("drive_token", accessToken);
};
