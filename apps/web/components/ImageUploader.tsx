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
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
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

  async function startCamera(deviceId?: string) {
    setCameraError(null);
    try {
      // No specific device requested yet: prefer the rear/environment camera
      // on phones. Once we know what devices exist (after permission is
      // granted, below), the picker lets you target a specific one — e.g. a
      // USB webcam instead of a laptop's built-in one, which facingMode
      // can't reliably distinguish on desktop.
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
      setSelectedDeviceId(activeDeviceId);

      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
    } catch {
      setCameraError("Could not access camera.");
    }
  }

  function handleDeviceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    startCamera(e.target.value);
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
          <button type="button" onClick={() => startCamera()} className="rounded border px-3 py-2 text-sm">
            Use Camera
          </button>
        ) : (
          <button type="button" onClick={stopCamera} className="rounded border px-3 py-2 text-sm">
            Cancel Camera
          </button>
        )}
        {cameraActive && videoDevices.length > 1 && (
          <select
            value={selectedDeviceId ?? ""}
            onChange={handleDeviceChange}
            className="rounded border px-2 py-2 text-sm"
          >
            {videoDevices.map((device, i) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}

      {/* Always mounted (never conditionally rendered) so videoRef.current is
          available the moment startCamera() needs to attach the stream —
          conditionally rendering this on cameraActive meant the stream was
          being attached to a ref that didn't exist yet. */}
      <div className={cameraActive ? "flex flex-col gap-2" : "hidden"}>
        <video ref={videoRef} className="max-w-sm rounded" muted playsInline />
        <button
          type="button"
          onClick={capturePhoto}
          className="w-fit rounded bg-neutral-800 px-3 py-2 text-sm text-white"
        >
          Capture Photo
        </button>
      </div>

      {image && !cameraActive && (
        <img src={image} alt="Room preview" className="max-w-sm rounded border" />
      )}
    </div>
  );
}
