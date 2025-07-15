import { Id } from "../convex/_generated/dataModel";

interface SimpleAudioStreamingProps {
  streamId: Id<"streams">;
  participants: Array<{
    _id: string;
    userId: Id<"users">;
    role: string;
    userName: string;
  }>;
  currentUserRole: string | null;
  isMicOn: boolean;
  audioStream: MediaStream | null;
}

export function SimpleAudioStreaming({ 
  participants, 
  currentUserRole, 
  isMicOn, 
  audioStream 
}: SimpleAudioStreamingProps) {
  const canSpeak = currentUserRole === "host" || currentUserRole === "cohost";
  const speakingParticipants = participants.filter(p => 
    p.role === "host" || p.role === "cohost"
  );

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="font-semibold mb-3">Audio Status</h3>
      
      {canSpeak && (
        <div className="mb-3">
          {isMicOn && audioStream ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Microphone is active - Ready to broadcast
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              Microphone is off
            </div>
          )}
        </div>
      )}

      {currentUserRole === "listener" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            {speakingParticipants.length > 0 
              ? `Listening to ${speakingParticipants.length} speaker(s)`
              : "No active speakers"
            }
          </p>
          {speakingParticipants.map(speaker => (
            <div key={speaker.userId} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>{speaker.userName}</span>
              <span className="text-gray-500">({speaker.role})</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 p-3 bg-blue-50 rounded-md">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> Audio streaming is currently in development. 
          The microphone access and participant status are working, but peer-to-peer 
          audio transmission will be added in the next update.
        </p>
      </div>
    </div>
  );
}
