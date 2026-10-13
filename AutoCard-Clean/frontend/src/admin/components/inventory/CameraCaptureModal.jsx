import { useState, useEffect, useRef } from "react";
import {
  Camera, X, RotateCcw, Check, SwitchCamera, VideoOff, Loader2, Sparkles, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const CameraCaptureModal = ({ isOpen, onClose, onCapture }) => {
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" (back) or "user" (front)
  const [cameraError, setCameraError] = useState(null);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fallbackInputRef = useRef(null);

  // Stop camera stream safely
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      setStream(null);
    }
  };

  // Start camera
  const startCamera = async (mode = facingMode) => {
    stopStream();
    setCameraError(null);
    setLoadingCamera(true);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError("Camera API is not supported on this device/browser.");
      setLoadingCamera(false);
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera start error with requested facingMode:", err);
      // Fallback: try default without facingMode constraint
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr) {
        console.error("Camera access completely failed:", fallbackErr);
        let msg = "Unable to access camera.";
        if (fallbackErr.name === "NotAllowedError" || fallbackErr.name === "PermissionDeniedError") {
          msg = "Camera permission was denied. Please allow camera access in browser settings.";
        } else if (fallbackErr.name === "NotFoundError" || fallbackErr.name === "DevicesNotFoundError") {
          msg = "No camera device found on this system.";
        }
        setCameraError(msg);
      }
    } finally {
      setLoadingCamera(false);
    }
  };

  // Switch facing mode (front / back)
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture current frame from video feed
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw frame
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedPhoto(dataUrl);

    // Stop live stream tracks while previewing
    stopStream();
  };

  // Retake photo: discard snapshot and restart camera
  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera(facingMode);
  };

  // Confirm photo: convert dataUrl to File and callback
  const handleConfirmPhoto = () => {
    if (!capturedPhoto) return;

    try {
      const byteString = atob(capturedPhoto.split(",")[1]);
      const mimeString = capturedPhoto.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);

      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      const blob = new Blob([ab], { type: mimeString });
      const file = new File([blob], `camera_snap_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      onCapture(file);
      handleClose();
    } catch (err) {
      console.error("Failed to process captured image:", err);
      toast.error("Failed to process captured photo.");
    }
  };

  const handleClose = () => {
    stopStream();
    setCapturedPhoto(null);
    setCameraError(null);
    onClose();
  };

  // Fallback for mobile native camera input
  const handleFallbackFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
      handleClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      startCamera("environment");
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-[#142848] px-5 py-4 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Take Product Photo
              </h3>
              <p className="text-xs text-white/70">
                {capturedPhoto
                  ? "Review snapshot or retake"
                  : "Align product in the frame and click capture"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="p-4 sm:p-6 bg-background flex flex-col items-center">
          <div className="w-full relative aspect-4/3 max-h-[380px] rounded-2xl bg-black overflow-hidden flex items-center justify-center border border-border/80 shadow-inner">
            {/* Hidden canvas for snapshot rendering */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Hidden native camera capture input for fallbacks */}
            <input
              type="file"
              ref={fallbackInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFallbackFileChange}
            />

            {/* Case 1: Snapshot Captured */}
            {capturedPhoto ? (
              <div className="w-full h-full relative">
                <img
                  src={capturedPhoto}
                  alt="Captured snapshot"
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-black/60 text-emerald-400 border border-emerald-500/30 backdrop-blur-xs flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Snapshot Captured
                </span>
              </div>
            ) : cameraError ? (
              /* Case 2: Camera Error */
              <div className="p-6 text-center text-white flex flex-col items-center max-w-sm">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                  <VideoOff className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-sm mb-1 text-white">
                  Camera Unavailable
                </h4>
                <p className="text-xs text-white/70 mb-4 leading-relaxed">
                  {cameraError}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Retry Access
                  </button>
                  <button
                    type="button"
                    onClick={() => fallbackInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Open Camera App
                  </button>
                </div>
              </div>
            ) : (
              /* Case 3: Live Video Stream */
              <div className="w-full h-full relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Viewfinder Framing Grid Guide */}
                <div className="absolute inset-4 border-2 border-white/30 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-t-2 border-l-2 border-white" />
                    <span className="w-4 h-4 border-t-2 border-r-2 border-white" />
                  </div>
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-b-2 border-l-2 border-white" />
                    <span className="w-4 h-4 border-b-2 border-r-2 border-white" />
                  </div>
                </div>

                {loadingCamera && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-medium">Starting camera...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 sm:p-5 bg-secondary/30 border-t border-border flex items-center justify-between gap-3">
          {capturedPhoto ? (
            /* Controls after capture */
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border hover:bg-secondary text-xs font-semibold text-foreground cursor-pointer transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retake Photo</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-md cursor-pointer transition-all"
              >
                <Check className="h-4 w-4" />
                <span>Use This Photo</span>
              </button>
            </>
          ) : (
            /* Controls during live preview */
            <>
              <button
                type="button"
                onClick={handleToggleFacingMode}
                disabled={loadingCamera || Boolean(cameraError)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors disabled:opacity-40"
                title="Switch Camera (Front/Back)"
              >
                <SwitchCamera className="h-4 w-4" />
                <span className="hidden sm:inline">Flip Camera</span>
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  disabled={loadingCamera || Boolean(cameraError)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  <span>Capture Photo</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCaptureModal;
