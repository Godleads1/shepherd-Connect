import { apiPost } from "./api-call";

interface DisplayCredential {
  token: string;
  classId: number;
  expiresAt: string;
}

export async function openClassroomDisplay(classId: number): Promise<void> {
  const popup = window.open("", "_blank");
  try {
    const credential = await apiPost<DisplayCredential>("/pickup-requests/display-credentials", { classId });
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const url = new URL(`${window.location.origin}${base}/classroom-display/${classId}`);
    url.searchParams.set("display", credential.token);
    if (popup) {
      popup.opener = null;
      popup.location.href = url.toString();
    } else {
      window.location.href = url.toString();
    }
  } catch (error) {
    popup?.close();
    throw error;
  }
}