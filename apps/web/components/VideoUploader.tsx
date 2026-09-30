"use client";

import { useEffect, useRef, useState } from "react";
import { blobToDataUrl, getVideoDuration, pickSupportedRecordingMimeType } from "@/lib/video";
import { MAX_VIDEO_DURATION_SECONDS_UI, MIN_VIDEO_DURATION_SECONDS_UI, VIDEO_RECORDING_MAX_HEIGHT } from "@/lib/constants";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
// Comfortably under the recorded clip's own footprint at 720p/5s — a
// generous ceiling for uploaded files specifically, not a target.
const MAX_UPLOAD_BYTES_UI = 20 * 1024 * 1024;

export function VideoUploader({
  video,
  onVideoCaptured,
}: {
  video: string | null;
  onVideoCaptured: (dataUrl: string) => void;
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current);
    };
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please choose an MP4, MOV, or WEBM video.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES_UI) {
      setError(`Video is too large — please keep it under ${Math.round(MAX_UPLOAD_BYTES_UI / 1_048_576)}MB.`);
      return;
    }

    try {
      const duration = await getVideoDuration(file);
      if (duration < MIN_VIDEO_DURATION_SECONDS_UI || duration > MAX_VIDEO_DURATION_SECONDS_UI) {
        setError(
          `Video must be between ${MIN_VIDEO_DURATION_SECONDS_UI} and ${MAX_VIDEO_DURATION_SECONDS_UI} seconds (yours is ${duration.toFixed(1)}s).`
        );
        return;
      }
    } catch {
      setError("Could not read that video file.");
      return;
    }

    const dataUrl = await blobToDataUrl(file);
    onVideoCaptured(dataUrl);
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, height: { ideal: VIDEO_RECORDING_MAX_HEIGHT } },
        audio: false,
      });

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError("Could not access camera.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    setError(null);

    const mimeType = pickSupportedRecordingMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType ?? "video/webm" });
      const dataUrl = await blobToDataUrl(blob);
      onVideoCaptured(dataUrl);
      stopCamera();
    };

    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setElapsedSeconds(0);

    elapsedIntervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 0.1), 100);
    autoStopTimeoutRef.current = setTimeout(() => stopRecording(), MAX_VIDEO_DURATION_SECONDS_UI * 1000);
  }

  function stopRecording() {
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current);
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const canStopRecording = elapsedSeconds >= MIN_VIDEO_DURATION_SECONDS_UI;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="cursor-pointer rounded bg-neutral-800 px-3 py-2 text-sm text-white">
          Upload Video
          <input type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleFileChange} />
        </label>
        {!cameraActive ? (
          <button type="button" onClick={startCamera} className="rounded border px-3 py-2 text-sm">
            Use Camera
          </button>
        ) : (
          <button type="button" onClick={stopCamera} disabled={recording} className="rounded border px-3 py-2 text-sm disabled:opacity-40">
            Cancel Camera
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className={cameraActive ? "flex flex-col gap-2" : "hidden"}>
        <video ref={videoRef} className="max-w-sm rounded" muted playsInline />
        {!recording ? (
          <button type="button" onClick={startRecording} className="w-fit rounded bg-neutral-800 px-3 py-2 text-sm text-white">
            Start Recording
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={stopRecording}
              disabled={!canStopRecording}
              className="w-fit rounded bg-neutral-800 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Stop Recording
            </button>
            <span className="text-xs text-neutral-500">
              {elapsedSeconds.toFixed(1)}s / {MAX_VIDEO_DURATION_SECONDS_UI}s
            </span>
          </div>
        )}
      </div>

      {video && !cameraActive && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={video} controls className="max-w-sm rounded border" />
      )}
    </div>
  );
}
