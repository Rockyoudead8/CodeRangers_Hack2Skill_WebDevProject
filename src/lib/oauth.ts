import {
  type Auth,
  type UserCredential,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

const googleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/drive.file");
  return provider;
};

const getCode = (error: unknown) => {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code?: unknown }).code);
  }

  if (error instanceof Error) {
    return (
      error.message
        .match(/\(auth\/[^)]+\)|auth\/[a-z-]+/)?.[0]
        ?.replace(/[()]/g, "") ?? ""
    );
  }

  return "";
};

export const signInWithGoogle = (auth: Auth): Promise<UserCredential> =>
  signInWithPopup(auth, googleProvider());

export const getGoogleAuthErrorMessage = (error: unknown) => {
  const code = getCode(error);

  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "The sign-in popup was blocked. Please allow popups and try again.";
    case "auth/unauthorized-domain":
      return "This deployed domain is not authorized in Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "This email already uses another sign-in method. Please use that method.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return code
        ? `Google sign-in failed (${code}).`
        : "Google sign-in failed.";
  }
};

export const saveGoogleDriveToken = (result: UserCredential) => {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;
  if (accessToken) localStorage.setItem("drive_token", accessToken);
};
