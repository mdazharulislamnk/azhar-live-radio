import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";
import { Chat } from "./Chat";
import { WorkingAudioStreaming } from "./WorkingAudioStreaming";

interface StreamRoomProps {
  streamId: Id<"streams">;
  onLeave: () => void;
}

export function StreamRoom({ streamId, onLeave }: StreamRoomProps) {
  const [showCohostModal, setShowCohostModal] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  
  const streamDetails = useQuery(api.streams.getStreamDetails, { streamId });
  const joinStream = useMutation(api.streams.joinStream);
  const leaveStream = useMutation(api.streams.leaveStream);
  const endStream = useMutation(api.streams.endStream);
  const promoteToCohost = useMutation(api.streams.promoteToCohost);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Auto-join stream when component mounts
    joinStream({ streamId }).catch((error) => {
      toast.error(error.message);
      onLeave();
    });

    return () => {
      // Cleanup audio stream
      if (audioStream) {
        audioStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped audio track:', track.kind);
        });
      }
    };
  }, [streamId]);

  const handleLeave = async () => {
    try {
      await leaveStream({ streamId });
      if (audioStream) {
        audioStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped audio track on leave:', track.kind);
        });
      }
      onLeave();
    } catch (error) {
      toast.error("Failed to leave stream");
    }
  };

  const handleEndStream = async () => {
    if (confirm("Are you sure you want to end this stream?")) {
      try {
        await endStream({ streamId });
        toast.success("Stream ended");
        onLeave();
      } catch (error) {
        toast.error("Failed to end stream");
      }
    }
  };

  const handlePromoteToCohost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) return;

    setIsPromoting(true);
    try {
      await promoteToCohost({ streamId, secretKey: secretKey.trim() });
      toast.success("You are now a co-host!");
      setShowCohostModal(false);
      setSecretKey("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to become co-host");
    } finally {
      setIsPromoting(false);
    }
  };

  const toggleMic = async () => {
    if (!isMicOn) {
      try {
        console.log('Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          } 
        });
        
        console.log('Microphone access granted, tracks:', stream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState
        })));
        
        setAudioStream(stream);
        setIsMicOn(true);
        setMicPermissionDenied(false);
        toast.success("Microphone enabled - You can now broadcast!");
      } catch (error) {
        console.error('Microphone access error:', error);
        setMicPermissionDenied(true);
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            toast.error("Microphone access denied. Please allow microphone access and try again.");
          } else if (error.name === 'NotFoundError') {
            toast.error("No microphone found. Please connect a microphone and try again.");
          } else {
            toast.error(`Failed to access microphone: ${error.message}`);
          }
        } else {
          toast.error("Failed to access microphone");
        }
      }
    } else {
      if (audioStream) {
        audioStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped audio track:', track.kind);
        });
        setAudioStream(null);
      }
      setIsMicOn(false);
      toast.success("Microphone disabled");
    }
  };

  if (!streamDetails) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const isHost = streamDetails.currentUserRole === "host";
  const isCohost = streamDetails.currentUserRole === "cohost";
  const canSpeak = isHost || isCohost;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Stream Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
              <div>
                <h1 className="text-2xl font-bold">{streamDetails.title}</h1>
                <p className="text-red-100">
                  Hosted by {streamDetails.hostName} • {streamDetails.participants.length} listeners
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!canSpeak && (
                <button
                  onClick={() => setShowCohostModal(true)}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Become Co-host
                </button>
              )}
              <button
                onClick={handleLeave}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Leave
              </button>
              {isHost && (
                <button
                  onClick={handleEndStream}
                  className="bg-red-800 hover:bg-red-900 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  End Stream
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Audio Controls */}
            {canSpeak && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">
                  {isHost ? "Host Controls" : "Co-host Controls"}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleMic}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        isMicOn
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      <span>{isMicOn ? "🎤" : "🔇"}</span>
                      {isMicOn ? "Mic On" : "Mic Off"}
                    </button>
                    {isMicOn && audioStream && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        Broadcasting ({audioStream.getTracks().length} track{audioStream.getTracks().length !== 1 ? 's' : ''})
                      </div>
                    )}
                  </div>
                  
                  {micPermissionDenied && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        <strong>Microphone Access Required:</strong> Please allow microphone access in your browser settings and refresh the page to enable broadcasting.
                      </p>
                    </div>
                  )}
                  
                  {audioStream && (
                    <div className="text-xs text-gray-600">
                      Audio tracks: {audioStream.getAudioTracks().map((track, i) => (
                        <span key={i} className="inline-block mr-2">
                          Track {i + 1}: {track.readyState} ({track.enabled ? 'enabled' : 'disabled'})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Audio Streaming */}
            <WorkingAudioStreaming
              streamId={streamId}
              participants={streamDetails.participants}
              currentUserRole={streamDetails.currentUserRole}
              isMicOn={isMicOn}
              audioStream={audioStream}
            />

            {/* Stream Description */}
            {streamDetails.description && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">About this stream</h3>
                <p className="text-gray-700">{streamDetails.description}</p>
              </div>
            )}

            {/* Participants */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                Participants ({streamDetails.participants.length})
              </h3>
              <div className="space-y-2">
                {streamDetails.participants.map((participant) => (
                  <div
                    key={participant._id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        {participant.role === "host" ? "👑" : 
                         participant.role === "cohost" ? "🎙️" : "👤"}
                      </div>
                      <div>
                        <span className="font-medium">{participant.userName}</span>
                        <span className="text-sm text-gray-500 ml-2 capitalize">
                          {participant.role}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Sidebar */}
          <div className="lg:col-span-1">
            <Chat streamId={streamId} />
          </div>
        </div>
      </div>

      {/* Co-host Modal */}
      {showCohostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Become Co-host</h2>
              <button
                onClick={() => setShowCohostModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePromoteToCohost} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secret Key
                </label>
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter secret key"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the secret key to become a co-host and speak in this stream
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCohostModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPromoting || !secretKey.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPromoting ? "Promoting..." : "Become Co-host"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
