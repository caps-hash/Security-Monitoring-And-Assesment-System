"use client";

import { useEffect, useRef, useState } from "react";
import { previewLocationLabel, recordAttendance } from "@/app/dashboard/employee/dtr/actions";
import {
  configuredGeofence,
  evaluateLocation,
  formatManilaDate,
  formatManilaTime,
  parseGps,
  type PunchAction,
} from "@/lib/attendance/policy";
import type { DutyContext } from "@/lib/attendance/types";

type CaptureState =
  | { phase: "idle" }
  | { phase: "locating"; action: PunchAction }
  | { phase: "camera"; action: PunchAction; gps: GpsPreview }
  | { phase: "preview"; action: PunchAction; gps: GpsPreview; photo: Blob; photoUrl: string; lines: string[] }
  | { phase: "submitting"; action: PunchAction };

type GpsPreview = {
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: string;
  place: string | null;
};

export function AttendanceCapture({
  duty,
  openSession,
  completedToday,
  employeeNumber,
  schemaReady,
}: {
  duty: DutyContext | null;
  openSession: boolean;
  completedToday: boolean;
  employeeNumber: string | null;
  schemaReady: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CaptureState>({ phase: "idle" });
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(false);

  useEffect(() => {
    return () => stopStream(streamRef.current);
  }, []);

  useEffect(() => {
    if (state.phase === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [state]);

  const canTimeIn = schemaReady && Boolean(duty) && !openSession && !completedToday && state.phase === "idle";
  const canTimeOut = schemaReady && Boolean(duty) && openSession && state.phase === "idle";
  const busy = state.phase === "locating" || state.phase === "submitting";

  async function begin(action: PunchAction) {
    setMessage(null);
    setMessageOk(false);
    if (!duty) {
      setMessage("Attendance is blocked until HR assigns a post, location, and shift.");
      return;
    }
    if (!navigator.geolocation) {
      setMessage("This browser does not support location capture. Attendance was not recorded.");
      return;
    }
    setState({ phase: "locating", action });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const gps = parseGps(
          String(position.coords.latitude),
          String(position.coords.longitude),
          String(position.coords.accuracy),
        );
        if (!gps) {
          setState({ phase: "idle" });
          setMessage("The device returned an invalid location. Attendance was not recorded.");
          return;
        }
        const decision = evaluateLocation(
          gps,
          configuredGeofence({
            latitude: duty.latitude,
            longitude: duty.longitude,
            radiusMeters: duty.radiusMeters,
          }),
        );
        if (!decision.ok) {
          setState({ phase: "idle" });
          setMessage(decision.message);
          return;
        }
        let place: string | null = null;
        try {
          place = await previewLocationLabel(gps.latitude, gps.longitude);
        } catch {
          place = null;
        }
        const preview = {
          ...gps,
          capturedAt: new Date().toISOString(),
          place,
        };
        try {
          await openCamera();
          setState({ phase: "camera", action, gps: preview });
        } catch (error) {
          stopStream(streamRef.current);
          setState({ phase: "idle" });
          setMessage(cameraMessage(error));
        }
      },
      (error) => {
        setState({ phase: "idle" });
        setMessage(locationMessage(error));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("unsupported");
    }
    if (!window.isSecureContext) {
      throw new Error("insecure");
    }
    stopStream(streamRef.current);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }

  async function capture() {
    if (state.phase !== "camera" || !videoRef.current) {
      return;
    }
    const lines = watermarkLines(state.action, state.gps, employeeNumber);
    try {
      const photo = await drawWatermark(videoRef.current, lines);
      stopStream(streamRef.current);
      streamRef.current = null;
      setState({
        phase: "preview",
        action: state.action,
        gps: state.gps,
        photo,
        photoUrl: URL.createObjectURL(photo),
        lines,
      });
    } catch {
      setMessage("The photo could not be processed. Retake it. Attendance was not recorded.");
    }
  }

  function cancel() {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (state.phase === "preview") {
      URL.revokeObjectURL(state.photoUrl);
    }
    setState({ phase: "idle" });
  }

  async function retake() {
    if (state.phase !== "preview") {
      return;
    }
    try {
      await openCamera();
      setState({ phase: "camera", action: state.action, gps: state.gps });
    } catch (error) {
      setState({ phase: "idle" });
      setMessage(cameraMessage(error));
    }
  }

  async function submit() {
    if (state.phase !== "preview") {
      return;
    }
    setState({ phase: "submitting", action: state.action });
    const body = new FormData();
    body.set("action", state.action);
    body.set("latitude", String(state.gps.latitude));
    body.set("longitude", String(state.gps.longitude));
    body.set("accuracy", String(state.gps.accuracyM));
    body.set("capturedAt", state.gps.capturedAt);
    body.set("photo", new File([state.photo], "attendance.jpg", { type: "image/jpeg" }));
    try {
      const result = await recordAttendance(body);
      setMessage(result.message);
      setMessageOk(result.ok);
      setState({ phase: "idle" });
      if (result.ok) {
        URL.revokeObjectURL(state.photoUrl);
        window.location.reload();
      } else {
        URL.revokeObjectURL(state.photoUrl);
      }
    } catch {
      setMessage("The network request failed. Attendance was not marked successful. Retry.");
      setState({ phase: "idle" });
    }
  }

  return (
    <section aria-labelledby="attendance-actions-heading" className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900" id="attendance-actions-heading">
        Record attendance
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
        The photo watermark uses this device&apos;s capture time. The official
        attendance time is the server time saved with the record. This photo is
        attendance evidence only. No facial recognition is performed.
      </p>
      {!schemaReady ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          Attendance storage is not ready. Re-run supabase/schema.sql before recording Time In or Time Out.
        </p>
      ) : null}
      {!duty ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          No duty assignment is on file. Time In and Time Out stay blocked.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canTimeIn || busy}
          onClick={() => void begin("time_in")}
          type="button"
        >
          {state.phase === "locating" && state.action === "time_in" ? "Getting location..." : "Time In"}
        </button>
        <button
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canTimeOut || busy}
          onClick={() => void begin("time_out")}
          type="button"
        >
          {state.phase === "locating" && state.action === "time_out" ? "Getting location..." : "Time Out"}
        </button>
      </div>
      {message ? (
        <p
          aria-live="polite"
          className={`mt-4 text-sm ${messageOk ? "text-emerald-700" : "text-red-700"}`}
          role={messageOk ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}
      {state.phase === "camera" || state.phase === "preview" ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center"
          role="dialog"
        >
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-lg">
            <h3 className="text-base font-semibold text-slate-950">
              {state.action === "time_in" ? "Time In photo" : "Time Out photo"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              GPS {state.gps.latitude.toFixed(6)}, {state.gps.longitude.toFixed(6)} · accuracy{" "}
              {Math.round(state.gps.accuracyM)} m
            </p>
            {state.phase === "camera" ? (
              <video
                autoPlay
                className="mt-3 aspect-[4/3] w-full rounded-lg bg-slate-950 object-cover"
                muted
                playsInline
                ref={videoRef}
              />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Watermarked attendance preview"
                  className="mt-3 w-full rounded-lg"
                  src={state.photoUrl}
                />
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {state.phase === "camera" ? (
                <button
                  className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white"
                  onClick={() => void capture()}
                  type="button"
                >
                  Capture photo
                </button>
              ) : (
                <>
                  <button
                    className="rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={false}
                    onClick={() => void submit()}
                    type="button"
                  >
                    Submit attendance
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
                    onClick={() => void retake()}
                    type="button"
                  >
                    Retake
                  </button>
                </>
              )}
              <button
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700"
                onClick={cancel}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {state.phase === "submitting" ? (
        <p className="mt-3 text-sm text-slate-600" role="status">
          Saving attendance. Do not close this page.
        </p>
      ) : null}
    </section>
  );
}

function watermarkLines(action: PunchAction, gps: GpsPreview, employeeNumber: string | null): string[] {
  const captured = new Date(gps.capturedAt);
  return [
    `DATE: ${formatManilaDate(captured)}`,
    `TIME: ${formatManilaTime(captured)}`,
    `TYPE: ${action === "time_in" ? "TIME IN" : "TIME OUT"}`,
    employeeNumber ? `EMPLOYEE NO: ${employeeNumber}` : "EMPLOYEE NO: not provided",
    `LOCATION: ${gps.place ?? "Not resolved"}`,
    `GPS: ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`,
    `ACCURACY: ${Math.round(gps.accuracyM)} m`,
  ];
}

async function drawWatermark(video: HTMLVideoElement, lines: string[]): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error("camera-frame");
  }
  const scale = Math.min(1, 1600 / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas");
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const lineHeight = Math.max(16, Math.round(canvas.width / 42));
  const padding = Math.round(lineHeight * 0.7);
  const barHeight = lineHeight * lines.length + padding * 2;
  context.fillStyle = "rgba(15, 23, 42, 0.62)";
  context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
  context.fillStyle = "#ffffff";
  context.font = `600 ${Math.round(lineHeight * 0.72)}px sans-serif`;
  lines.forEach((line, index) => {
    context.fillText(
      line,
      padding,
      canvas.height - barHeight + padding + lineHeight * (index + 0.75),
    );
  });
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });
  if (!blob) {
    throw new Error("export");
  }
  if (blob.size > 2_000_000) {
    const smaller = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.62);
    });
    if (!smaller || smaller.size > 2_000_000) {
      throw new Error("too-large");
    }
    return smaller;
  }
  return blob;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function locationMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Allow location access for this site in the browser settings, then retry. Attendance was not recorded.";
  }
  if (error.code === error.TIMEOUT) {
    return "Location request timed out. Move to a clearer signal and retry. Attendance was not recorded.";
  }
  return "Location is unavailable. Enable location services and retry. Attendance was not recorded.";
}

function cameraMessage(error: unknown): string {
  const name = error instanceof Error ? error.message || error.name : "";
  if (name === "unsupported" || name === "insecure") {
    return "Camera capture needs a supported browser on HTTPS or localhost. Attendance was not recorded.";
  }
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "Camera permission was denied. Allow camera access for this site, then retry. Attendance was not recorded.";
  }
  if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "NotReadableError")) {
    return "No usable camera was found. Connect a camera and retry. Attendance was not recorded.";
  }
  return "The camera could not be opened. Attendance was not recorded.";
}
