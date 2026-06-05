import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'camera',
  born: '2026-06-05',
  purpose:
    'Reusable in-app camera (operator: "let\'s build a camera ... use it as well as any other place that needs it"). CameraCaptureModal opens a live getUserMedia preview with a front/back toggle and a shutter that captures the current frame to a JPEG File, handed back via onCapture. A pure capture device — it knows nothing about journals, chats, or signing; every surface that needs a photo links to this one component so there is one camera, not several. The journal composer is the first consumer: a captured photo flows into the existing normalizeImage -> sign -> anchor -> stamp pipeline so "take it through the app and it stamps it" becomes literal. Messaging and other surfaces link the same modal.',
  touches: ['src/features/camera/CameraCaptureModal.tsx'],
  depends_on: [],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'Grounded against QrScanModal (the wallet\'s existing getUserMedia surface): on an INSTALLED iOS PWA, live getUserMedia is unreliable — the prompt may never fire — so the modal defaults that platform (and anywhere navigator.mediaDevices is missing) to the native <input type=file accept=image/* capture> path, which DOES open the system camera reliably from a home-screen PWA. The live preview also degrades to that native input on any getUserMedia error, and a "choose from library" path is always offered. The stream lifecycle uses a cancelled flag + cleanup that stops all tracks on unmount and on facing-toggle; the effect deps are [facing, useFallback] only, so UI status changes never tear down the stream. The front-camera preview is CSS-mirrored (-scale-x-100) but the captured frame is saved unmirrored (standard selfie convention). depends_on is empty so journal/messaging/etc. can depend on camera with no import cycle. removal_safe is false because consumers import CameraCaptureModal directly; pause_safe is true because hiding the entry points leaves the OS picker paths intact.',
};
