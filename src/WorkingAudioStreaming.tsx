import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

interface WorkingAudioStreamingProps {
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

export function WorkingAudioStreaming({ 
  streamId, 
  participants, 
  currentUserRole, 
  isMicOn, 
  audioStream 
}: WorkingAudioStreamingProps) {
  const [connections, setConnections] = useState<Map<Id<"users">, RTCPeerConnection>>(new Map());
  const [receivingAudio, setReceivingAudio] = useState<Set<Id<"users">>>(new Set());
  const [connectionStates, setConnectionStates] = useState<Map<Id<"users">, string>>(new Map());
  
  const signals = useQuery(api.webrtc.getWebRTCSignals, { streamId });
  const sendSignal = useMutation(api.webrtc.sendWebRTCSignal);
  const clearOldSignals = useMutation(api.webrtc.clearOldSignals);
  
  const connectionsRef = useRef<Map<Id<"users">, RTCPeerConnection>>(new Map());
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const audioElementsRef = useRef<Map<Id<"users">, HTMLAudioElement>>(new Map());
  const currentUserIdRef = useRef<Id<"users"> | null>(null);

  const canSpeak = currentUserRole === "host" || currentUserRole === "cohost";
  const speakingParticipants = participants.filter(p => 
    p.role === "host" || p.role === "cohost"
  );

  // Get current user ID
  useEffect(() => {
    const currentParticipant = participants.find(p => 
      p.role === currentUserRole && 
      (currentUserRole === "host" || currentUserRole === "cohost" || currentUserRole === "listener")
    );
    if (currentParticipant) {
      currentUserIdRef.current = currentParticipant.userId;
    }
  }, [participants, currentUserRole]);

  // ICE servers configuration with more STUN servers
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' }
  ];

  // Clear old signals periodically
  useEffect(() => {
    const interval = setInterval(() => {
      clearOldSignals({ streamId }).catch(console.error);
    }, 30000); // Clear every 30 seconds

    return () => clearInterval(interval);
  }, [streamId, clearOldSignals]);

  // Create peer connections for speakers to broadcast to listeners
  useEffect(() => {
    if (!canSpeak || !isMicOn || !audioStream || !currentUserIdRef.current) {
      // Clean up existing connections if mic is off
      connectionsRef.current.forEach(pc => {
        pc.close();
      });
      connectionsRef.current.clear();
      setConnections(new Map());
      setConnectionStates(new Map());
      return;
    }

    const listeners = participants.filter(p => p.role === "listener");
    console.log(`Setting up connections to ${listeners.length} listeners`);
    
    listeners.forEach(async (listener) => {
      if (!connectionsRef.current.has(listener.userId)) {
        try {
          console.log(`Creating connection to listener: ${listener.userName}`);
          const pc = new RTCPeerConnection({ iceServers });

          // Add audio tracks to the connection
          audioStream.getTracks().forEach(track => {
            console.log(`Adding track to connection for ${listener.userName}:`, track.kind);
            pc.addTrack(track, audioStream);
          });

          // Handle ICE candidates
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              console.log(`Sending ICE candidate to ${listener.userName}`);
              sendSignal({
                streamId,
                toUserId: listener.userId,
                signalType: 'ice-candidate',
                signalData: JSON.stringify(event.candidate),
              }).catch(console.error);
            }
          };

          pc.onconnectionstatechange = () => {
            console.log(`Connection to ${listener.userName}: ${pc.connectionState}`);
            setConnectionStates(prev => new Map(prev.set(listener.userId, pc.connectionState)));
          };

          pc.oniceconnectionstatechange = () => {
            console.log(`ICE connection to ${listener.userName}: ${pc.iceConnectionState}`);
          };

          // Create and send offer
          const offer = await pc.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false
          });
          await pc.setLocalDescription(offer);
          
          console.log(`Sending offer to ${listener.userName}`);
          await sendSignal({
            streamId,
            toUserId: listener.userId,
            signalType: 'offer',
            signalData: JSON.stringify(offer),
          });

          connectionsRef.current.set(listener.userId, pc);
          setConnections(new Map(connectionsRef.current));
        } catch (error) {
          console.error(`Error creating connection to ${listener.userName}:`, error);
        }
      }
    });

    // Clean up connections to users who are no longer listeners
    const currentListenerIds = new Set(listeners.map(l => l.userId));
    connectionsRef.current.forEach((pc, userId) => {
      if (!currentListenerIds.has(userId)) {
        console.log(`Cleaning up connection to user ${userId}`);
        pc.close();
        connectionsRef.current.delete(userId);
      }
    });
    setConnections(new Map(connectionsRef.current));

  }, [canSpeak, isMicOn, audioStream, participants, streamId, sendSignal]);

  // Process WebRTC signals
  useEffect(() => {
    if (!signals || !currentUserIdRef.current) return;

    signals.forEach(async (signal) => {
      const signalId = `${signal.fromUserId}-${signal.signalType}-${signal.timestamp}`;
      if (processedSignalsRef.current.has(signalId)) return;
      
      processedSignalsRef.current.add(signalId);
      console.log(`Processing signal: ${signal.signalType} from ${signal.fromUserId}`);

      try {
        const signalData = JSON.parse(signal.signalData);
        
        if (signal.signalType === 'offer' && currentUserRole === "listener") {
          // Listener receiving offer from speaker
          console.log(`Listener receiving offer from speaker ${signal.fromUserId}`);
          const pc = new RTCPeerConnection({ iceServers });

          // Handle incoming audio stream
          pc.ontrack = (event) => {
            console.log(`Received audio track from ${signal.fromUserId}`);
            const [remoteStream] = event.streams;
            if (remoteStream && remoteStream.getAudioTracks().length > 0) {
              // Remove existing audio element if any
              const existingAudio = audioElementsRef.current.get(signal.fromUserId);
              if (existingAudio) {
                existingAudio.pause();
                existingAudio.srcObject = null;
              }

              const audio = new Audio();
              audio.srcObject = remoteStream;
              audio.autoplay = true;
              audio.volume = 1.0;
              
              // Try to play immediately
              audio.play().then(() => {
                console.log(`Successfully playing audio from ${signal.fromUserId}`);
                setReceivingAudio(prev => new Set([...prev, signal.fromUserId]));
                audioElementsRef.current.set(signal.fromUserId, audio);
              }).catch((error) => {
                console.error(`Failed to play audio from ${signal.fromUserId}:`, error);
                // Try to play with user interaction
                const playAudio = () => {
                  audio.play().then(() => {
                    console.log(`Audio playing after user interaction from ${signal.fromUserId}`);
                    setReceivingAudio(prev => new Set([...prev, signal.fromUserId]));
                    audioElementsRef.current.set(signal.fromUserId, audio);
                    document.removeEventListener('click', playAudio);
                  }).catch(console.error);
                };
                document.addEventListener('click', playAudio, { once: true });
                toast.info("Click anywhere to enable audio playback");
              });
            }
          };

          // Handle ICE candidates
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              console.log(`Sending ICE candidate to speaker ${signal.fromUserId}`);
              sendSignal({
                streamId,
                toUserId: signal.fromUserId,
                signalType: 'ice-candidate',
                signalData: JSON.stringify(event.candidate),
              }).catch(console.error);
            }
          };

          pc.onconnectionstatechange = () => {
            console.log(`Connection from speaker ${signal.fromUserId}: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
              setReceivingAudio(prev => {
                const newSet = new Set(prev);
                newSet.delete(signal.fromUserId);
                return newSet;
              });
              // Clean up audio element
              const audio = audioElementsRef.current.get(signal.fromUserId);
              if (audio) {
                audio.pause();
                audio.srcObject = null;
                audioElementsRef.current.delete(signal.fromUserId);
              }
            }
          };

          // Set remote description and create answer
          await pc.setRemoteDescription(signalData);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          console.log(`Sending answer to speaker ${signal.fromUserId}`);
          await sendSignal({
            streamId,
            toUserId: signal.fromUserId,
            signalType: 'answer',
            signalData: JSON.stringify(answer),
          });

          connectionsRef.current.set(signal.fromUserId, pc);
          setConnections(new Map(connectionsRef.current));

        } else if (signal.signalType === 'answer' && canSpeak) {
          // Speaker receiving answer from listener
          console.log(`Speaker receiving answer from listener ${signal.fromUserId}`);
          const pc = connectionsRef.current.get(signal.fromUserId);
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(signalData);
            console.log(`Set remote description for listener ${signal.fromUserId}`);
          }

        } else if (signal.signalType === 'ice-candidate') {
          // Handle ICE candidates
          const pc = connectionsRef.current.get(signal.fromUserId);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(signalData);
            console.log(`Added ICE candidate from ${signal.fromUserId}`);
          } else {
            console.log(`Skipping ICE candidate from ${signal.fromUserId} - no remote description yet`);
          }
        }
      } catch (error) {
        console.error('Error processing signal:', error);
      }
    });
  }, [signals, currentUserRole, streamId, canSpeak, sendSignal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Cleaning up audio streaming component');
      connectionsRef.current.forEach(pc => pc.close());
      audioElementsRef.current.forEach(audio => {
        audio.pause();
        audio.srcObject = null;
      });
      connectionsRef.current.clear();
      audioElementsRef.current.clear();
    };
  }, []);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="font-semibold mb-3">🔊 Live Audio Streaming</h3>
      
      {canSpeak && (
        <div className="mb-3">
          {isMicOn && audioStream ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Broadcasting live audio to listeners
              </div>
              <div className="text-xs text-gray-600">
                Active connections: {connections.size} / {participants.filter(p => p.role === "listener").length} listeners
              </div>
              {connections.size > 0 && (
                <div className="text-xs space-y-1">
                  {Array.from(connections.entries()).map(([userId, _]) => {
                    const participant = participants.find(p => p.userId === userId);
                    const state = connectionStates.get(userId) || 'connecting';
                    return (
                      <div key={userId} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          state === 'connected' ? 'bg-green-500' : 
                          state === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span>{participant?.userName || 'Unknown'}: {state}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              Microphone is off - Turn on mic to broadcast
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
              <div className={`w-2 h-2 rounded-full ${
                receivingAudio.has(speaker.userId) 
                  ? 'bg-green-500 animate-pulse' 
                  : 'bg-gray-400'
              }`}></div>
              <span>{speaker.userName}</span>
              <span className="text-gray-500">({speaker.role})</span>
              {receivingAudio.has(speaker.userId) && (
                <span className="text-green-600 text-xs">🔊 LIVE</span>
              )}
            </div>
          ))}
          
          {connections.size > 0 && (
            <div className="text-xs text-gray-600 mt-2">
              Audio connections: {connections.size}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 p-3 bg-green-50 rounded-md">
        <p className="text-xs text-green-700">
          <strong>✅ Real Audio Streaming Active!</strong> 
          {canSpeak 
            ? " Your voice is being transmitted to listeners in real-time."
            : " You can hear speakers' voices live through WebRTC peer-to-peer connections."
          }
        </p>
        {currentUserRole === "listener" && receivingAudio.size === 0 && speakingParticipants.length > 0 && (
          <p className="text-xs text-orange-600 mt-1">
            <strong>Note:</strong> If you don't hear audio, click anywhere on the page to enable audio playback.
          </p>
        )}
      </div>
    </div>
  );
}
