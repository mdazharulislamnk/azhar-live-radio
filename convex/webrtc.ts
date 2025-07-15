import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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

export const sendWebRTCSignal = mutation({
  args: {
    streamId: v.id("streams"),
    toUserId: v.id("users"),
    signalType: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    signalData: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    await ctx.db.insert("webrtcSignals", {
      streamId: args.streamId,
      fromUserId: userId,
      toUserId: args.toUserId,
      signalType: args.signalType,
      signalData: args.signalData,
      timestamp: Date.now(),
    });

    return null;
  },
});

export const getWebRTCSignals = query({
  args: {
    streamId: v.id("streams"),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    // Get signals from the last 60 seconds to ensure we don't miss any
    const sixtySecondsAgo = Date.now() - 60000;
    
    const signals = await ctx.db
      .query("webrtcSignals")
      .withIndex("by_stream_and_to_user", (q) => 
        q.eq("streamId", args.streamId).eq("toUserId", userId)
      )
      .filter((q) => q.gte(q.field("timestamp"), sixtySecondsAgo))
      .order("asc")
      .collect();

    return signals;
  },
});

export const clearOldSignals = mutation({
  args: {
    streamId: v.id("streams"),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    // Delete signals older than 2 minutes
    const twoMinutesAgo = Date.now() - 120000;
    
    const oldSignals = await ctx.db
      .query("webrtcSignals")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .filter((q) => q.lt(q.field("timestamp"), twoMinutesAgo))
      .collect();

    for (const signal of oldSignals) {
      await ctx.db.delete(signal._id);
    }

    return { deletedCount: oldSignals.length };
  },
});
