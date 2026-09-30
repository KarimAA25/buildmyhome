import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

// Pin fluent-ffmpeg to the installer-provided binaries rather than relying on
// PATH — matches the "Windows users must set the path explicitly" caveat in
// fluent-ffmpeg's own docs, and keeps this working the same way in local dev
// and on Railway regardless of what's preinstalled on either.
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export { ffmpeg };
