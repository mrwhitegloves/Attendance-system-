'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, MapPin, MapPinOff, RotateCcw } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch.js';
import { formatDayName } from '@/lib/format.js';
import { Badge, Button, Card, ErrorText, Spinner } from '@/components/shared/ui.jsx';
import { ConfirmDialog } from '@/components/shared/Dialog.jsx';
import { statusTone } from '@/lib/format.js';
import { useLocation } from './useLocation.js';

/** Live India-time clock. */
function useClock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now
    ? now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';
}

/** Takes a frame from the video as a small JPEG (about 50 KB). */
function captureFrame(video) {
  const width = Math.min(640, video.videoWidth || 640);
  const height = Math.round(width * ((video.videoHeight || 480) / (video.videoWidth || 640)));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export function PunchScreen({ day }) {
  const router = useRouter();
  const clock = useClock();
  const location = useLocation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lateWarning, setLateWarning] = useState('');
  const [done, setDone] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      setCameraOn(true);
      setPhoto(null);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setError('Please allow camera access to take a photo.');
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    setPhoto(captureFrame(videoRef.current));
    stopCamera();
  };

  const submit = async (confirmLate = false) => {
    setBusy(true);
    setError('');
    try {
      const { record } = await apiFetch('/api/attendance', {
        method: 'POST',
        body: {
          selfie: photo,
          lat: location.coords?.lat,
          lon: location.coords?.lon,
          location: location.address,
          confirmLate,
        },
      });
      setLateWarning('');
      setPhoto(null);
      setDone(
        `${record.status === 'Checked Out' ? 'Punched out' : 'Punched in'} at ${record.time}${record.status === 'Late' ? ' (late)' : ''}.`,
      );
      router.refresh();
    } catch (failure) {
      if (failure.code === 'late_limit') setLateWarning(failure.message);
      else setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const nextLabel = day.next === 'in' ? 'Punch in' : 'Punch out';
  // A punch needs the location (founder, 2026-10-29): no location, no punch.
  const locationReady = location.status === 'ok';

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-3xl font-semibold tabular-nums">{clock}</p>
            <p className="text-sm text-muted">{formatDayName(day.date)}</p>
          </div>
          <p className="flex max-w-xs items-start gap-1.5 text-xs text-muted">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {location.address}
          </p>
        </div>

        {day.next !== 'done' && !locationReady && location.status !== 'finding' && (
          <LocationNeeded location={location} />
        )}

        {done && (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
            <CheckCircle2 size={16} /> {done}
          </p>
        )}

        {day.next === 'done' ? (
          <p className="rounded-lg bg-raised px-4 py-8 text-center text-sm text-muted">
            Your day is complete. See you tomorrow.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl bg-raised">
              {cameraOn && (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full -scale-x-100 object-cover"
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo && <img src={photo} alt="Your photo" className="h-full w-full object-cover" />}
              {!cameraOn && !photo && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
                  <Camera size={36} />
                  <p className="text-sm">Take a photo to {nextLabel.toLowerCase()}</p>
                </div>
              )}
            </div>
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap justify-center gap-2">
              {!cameraOn && !photo && (
                <Button size="lg" onClick={startCamera} disabled={!locationReady}>
                  <Camera size={18} /> {nextLabel}
                </Button>
              )}
              {cameraOn && (
                <Button size="lg" onClick={takePhoto}>
                  Take photo
                </Button>
              )}
              {photo && (
                <>
                  <Button variant="secondary" size="lg" onClick={startCamera} disabled={busy}>
                    <RotateCcw size={18} /> Retake
                  </Button>
                  <Button size="lg" onClick={() => submit(false)} disabled={busy || !locationReady}>
                    {busy && <Spinner />} Confirm {nextLabel.toLowerCase()}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Today</h2>
        <dl className="space-y-3 text-sm">
          <Row label="Shift" value={`${day.expectedInTime} – ${day.expectedOutTime}`} />
          <Row
            label="Punch in"
            value={
              day.punchIn ? (
                <>
                  <span>{day.punchIn.time}</span>{' '}
                  <Badge tone={statusTone(day.punchIn.status)}>{day.punchIn.status}</Badge>
                </>
              ) : (
                '—'
              )
            }
          />
          <Row label="Punch out" value={day.punchOut?.time ?? '—'} />
          <Row
            label="Late days this month"
            value={
              <span
                className={
                  day.lateDaysThisMonth >= day.lateLimit ? 'font-semibold text-danger' : ''
                }
              >
                {day.lateDaysThisMonth} of {day.lateLimit}
              </span>
            }
          />
        </dl>
        {day.onLeave && (
          <p className="mt-3 rounded-lg bg-info/10 px-3 py-2 text-xs text-info">
            You are on approved leave today.
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(lateWarning)}
        title="Late limit reached"
        text={lateWarning}
        confirmLabel="Punch in anyway"
        busy={busy}
        onConfirm={() => submit(true)}
        onClose={() => setLateWarning('')}
      />
    </div>
  );
}

/** Location is off or not found: a clear way to turn it on, and how. */
function LocationNeeded({ location }) {
  return (
    <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-danger">
        <MapPinOff size={18} />
        {location.status === 'denied'
          ? 'Turn on location to punch'
          : 'Your location is needed to punch'}
      </p>
      <p className="mt-1 text-muted">
        {location.status === 'denied'
          ? 'Your location is saved with every punch. Allow location for this site, then press the button.'
          : location.status === 'unsupported'
            ? 'This browser cannot share a location. Please open the app in Chrome or Safari on your phone.'
            : 'Switch on Location (GPS) on your phone, then press the button.'}
      </p>
      {location.status === 'denied' && (
        <ul className="mt-2 list-inside list-disc text-xs text-muted">
          <li>
            Android (Chrome): tap the icon left of the address bar → Permissions → Location → Allow.
          </li>
          <li>
            iPhone (Safari): Settings → Privacy → Location Services → Safari Websites → While Using.
          </li>
        </ul>
      )}
      {location.status !== 'unsupported' && (
        <Button className="mt-3" onClick={location.retry}>
          <MapPin size={16} /> Turn on location
        </Button>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right">{value}</dd>
    </div>
  );
}
