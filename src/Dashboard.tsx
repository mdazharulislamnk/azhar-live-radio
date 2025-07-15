import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { CreateStreamModal } from "./CreateStreamModal";
import { StreamCard } from "./StreamCard";
import { StreamRoom } from "./StreamRoom";
import { Id } from "../convex/_generated/dataModel";

export function Dashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentStreamId, setCurrentStreamId] = useState<Id<"streams"> | null>(null);
  const liveStreams = useQuery(api.streams.listLiveStreams);
  const user = useQuery(api.auth.loggedInUser);

  if (currentStreamId) {
    return (
      <StreamRoom 
        streamId={currentStreamId} 
        onLeave={() => setCurrentStreamId(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Radio Streams</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.name || user?.email}! Join a live stream or start your own.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <span>🎙️</span>
          Start Stream
        </button>
      </div>

      {liveStreams === undefined ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      ) : liveStreams.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📻</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Live Streams</h3>
          <p className="text-gray-600">Be the first to start a live radio stream!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveStreams.map((stream) => (
            <StreamCard
              key={stream._id}
              stream={stream}
              onJoin={() => setCurrentStreamId(stream._id)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateStreamModal
          onClose={() => setShowCreateModal(false)}
          onStreamCreated={(streamId) => {
            setShowCreateModal(false);
            setCurrentStreamId(streamId);
          }}
        />
      )}
    </div>
  );
}
