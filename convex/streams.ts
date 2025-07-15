import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const SECRET_KEY = "AzharRadio";

async function getAuthenticatedUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return { userId, user };
}

export const listLiveStreams = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);
    
    const liveStreams = await ctx.db
      .query("streams")
      .withIndex("by_live_status", (q) => q.eq("isLive", true))
      .collect();

    const streamsWithHosts = await Promise.all(
      liveStreams.map(async (stream) => {
        const host = await ctx.db.get(stream.hostId);
        const participantCount = await ctx.db
          .query("streamParticipants")
          .withIndex("by_stream", (q) => q.eq("streamId", stream._id))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        return {
          ...stream,
          hostName: host?.name || host?.email || "Unknown Host",
          participantCount: participantCount.length,
        };
      })
    );

    return streamsWithHosts;
  },
});

export const createStream = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    secretKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    if (args.secretKey !== SECRET_KEY) {
      throw new Error("Invalid secret key");
    }

    // Check if user already has an active stream
    const existingStream = await ctx.db
      .query("streams")
      .withIndex("by_host", (q) => q.eq("hostId", userId))
      .filter((q) => q.eq(q.field("isLive"), true))
      .first();

    if (existingStream) {
      throw new Error("You already have an active stream");
    }

    const streamId = await ctx.db.insert("streams", {
      title: args.title,
      description: args.description,
      hostId: userId,
      isLive: true,
      startedAt: Date.now(),
    });

    // Add host as participant
    await ctx.db.insert("streamParticipants", {
      streamId,
      userId,
      role: "host",
      joinedAt: Date.now(),
      isActive: true,
    });

    return streamId;
  },
});

export const endStream = mutation({
  args: {
    streamId: v.id("streams"),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const stream = await ctx.db.get(args.streamId);
    if (!stream) {
      throw new Error("Stream not found");
    }

    if (stream.hostId !== userId) {
      throw new Error("Only the host can end the stream");
    }

    await ctx.db.patch(args.streamId, {
      isLive: false,
      endedAt: Date.now(),
    });

    // Mark all participants as inactive
    const participants = await ctx.db
      .query("streamParticipants")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .collect();

    for (const participant of participants) {
      await ctx.db.patch(participant._id, { isActive: false });
    }

    return null;
  },
});

export const joinStream = mutation({
  args: {
    streamId: v.id("streams"),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const stream = await ctx.db.get(args.streamId);
    if (!stream || !stream.isLive) {
      throw new Error("Stream not found or not live");
    }

    // Check if already a participant
    const existingParticipant = await ctx.db
      .query("streamParticipants")
      .withIndex("by_stream_and_user", (q) => 
        q.eq("streamId", args.streamId).eq("userId", userId)
      )
      .first();

    if (existingParticipant) {
      if (!existingParticipant.isActive) {
        await ctx.db.patch(existingParticipant._id, { isActive: true });
      }
      return existingParticipant._id;
    }

    const participantId = await ctx.db.insert("streamParticipants", {
      streamId: args.streamId,
      userId,
      role: "listener",
      joinedAt: Date.now(),
      isActive: true,
    });

    return participantId;
  },
});

export const leaveStream = mutation({
  args: {
    streamId: v.id("streams"),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const participant = await ctx.db
      .query("streamParticipants")
      .withIndex("by_stream_and_user", (q) => 
        q.eq("streamId", args.streamId).eq("userId", userId)
      )
      .first();

    if (participant) {
      await ctx.db.patch(participant._id, { isActive: false });
    }

    return null;
  },
});

export const promoteToCohost = mutation({
  args: {
    streamId: v.id("streams"),
    secretKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    if (args.secretKey !== SECRET_KEY) {
      throw new Error("Invalid secret key");
    }

    const participant = await ctx.db
      .query("streamParticipants")
      .withIndex("by_stream_and_user", (q) => 
        q.eq("streamId", args.streamId).eq("userId", userId)
      )
      .first();

    if (!participant || !participant.isActive) {
      throw new Error("You must be an active participant to become a co-host");
    }

    if (participant.role === "host") {
      throw new Error("You are already the host");
    }

    await ctx.db.patch(participant._id, { role: "cohost" });

    return null;
  },
});

export const getStreamDetails = query({
  args: {
    streamId: v.id("streams"),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const stream = await ctx.db.get(args.streamId);
    if (!stream) {
      throw new Error("Stream not found");
    }

    const host = await ctx.db.get(stream.hostId);
    const participants = await ctx.db
      .query("streamParticipants")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const participantsWithUsers = await Promise.all(
      participants.map(async (participant) => {
        const user = await ctx.db.get(participant.userId);
        return {
          ...participant,
          userName: user?.name || user?.email || "Unknown User",
        };
      })
    );

    const currentUserParticipant = participants.find(p => p.userId === userId);

    return {
      ...stream,
      hostName: host?.name || host?.email || "Unknown Host",
      participants: participantsWithUsers,
      currentUserRole: currentUserParticipant?.role || null,
      isCurrentUserActive: currentUserParticipant?.isActive || false,
    };
  },
});
