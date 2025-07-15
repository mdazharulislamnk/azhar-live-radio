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

export const sendMessage = mutation({
  args: {
    streamId: v.id("streams"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    // Verify user is an active participant
    const participant = await ctx.db
      .query("streamParticipants")
      .withIndex("by_stream_and_user", (q) => 
        q.eq("streamId", args.streamId).eq("userId", userId)
      )
      .first();

    if (!participant || !participant.isActive) {
      throw new Error("You must be an active participant to send messages");
    }

    const messageId = await ctx.db.insert("chatMessages", {
      streamId: args.streamId,
      userId,
      message: args.message.trim(),
      timestamp: Date.now(),
    });

    return messageId;
  },
});

export const getMessages = query({
  args: {
    streamId: v.id("streams"),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    // Verify user is an active participant
    const participant = await ctx.db
      .query("streamParticipants")
      .withIndex("by_stream_and_user", (q) => 
        q.eq("streamId", args.streamId).eq("userId", userId)
      )
      .first();

    if (!participant || !participant.isActive) {
      throw new Error("You must be an active participant to view messages");
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_stream_and_timestamp", (q) => q.eq("streamId", args.streamId))
      .order("desc")
      .take(50);

    const messagesWithUsers = await Promise.all(
      messages.map(async (message) => {
        const user = await ctx.db.get(message.userId);
        return {
          ...message,
          userName: user?.name || user?.email || "Unknown User",
        };
      })
    );

    return messagesWithUsers.reverse();
  },
});
