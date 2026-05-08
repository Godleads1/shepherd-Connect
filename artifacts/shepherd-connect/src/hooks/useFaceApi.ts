import { useCallback, useRef, useState } from "react";

export type FaceApiStatus = "idle" | "loading" | "ready" | "error";

let faceApiInstance: typeof import("face-api.js") | null = null;
let modelsLoaded = false;

const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

export function useFaceApi() {
  const [status, setStatus] = useState<FaceApiStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const load = useCallback(async () => {
    if (modelsLoaded) { setStatus("ready"); return; }
    setStatus("loading");
    try {
      const faceapi = await import("face-api.js");
      faceApiInstance = faceapi;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      setStatus("ready");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to load face recognition models");
      setStatus("error");
    }
  }, []);

  const detectDescriptor = useCallback(async (
    input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<Float32Array | null> => {
    if (!faceApiInstance || !modelsLoaded) return null;
    const faceapi = faceApiInstance;
    const detection = await faceapi
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    return detection?.descriptor ?? null;
  }, []);

  return { status, errorMsg, load, detectDescriptor, faceapi: faceApiInstance };
}
