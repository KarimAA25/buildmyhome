"use client";

import { useRef, useState } from "react";
import { resizeImageFile, resizeVideoFrame } from "@/lib/resizeImage";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function ImageUploader({
  image,
  onImageCaptured,
}: {
  image: string | null;
  onImageCaptured: (dataUrl: string) => void;
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setCameraError("Please choose a PNG, JPEG, or WEBP image.");
      return;
    }
    setCameraError(null);
    const dataUrl = await resizeImageFile(file);
    onImageCaptured(dataUrl);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError("Could not access camera.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    onImageCaptured(resizeVideoFrame(video));
    stopCamera();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="cursor-pointer rounded bg-neutral-800 px-3 py-2 text-sm text-white">
          Upload Photo
          <input
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        {!cameraActive ? (
          <button type="button" onClick={startCamera} className="rounded border px-3 py-2 text-sm">
            Use Camera
          </button>
        ) : (
          <button type="button" onClick={stopCamera} className="rounded border px-3 py-2 text-sm">
            Cancel Camera
          </button>
        )}
      </div>

      {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}

      {cameraActive && (
        <div className="flex flex-col gap-2">
          <video ref={videoRef} className="max-w-sm rounded" muted playsInline />
          <button
            type="button"
            onClick={capturePhoto}
            className="w-fit rounded bg-neutral-800 px-3 py-2 text-sm text-white"
          >
            Capture Photo
          </button>
        </div>
      )}

      {image && !cameraActive && (
        <img src={image} alt="Room preview" className="max-w-sm rounded border" />
      )}
    </div>
  );
}
