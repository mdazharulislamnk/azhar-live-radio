import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  streams: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    hostId: v.id("users"),
    isLive: v.boolean(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_host", ["hostId"])
    .index("by_live_status", ["isLive"]),

  streamParticipants: defineTable({
    streamId: v.id("streams"),
    userId: v.id("users"),
    role: v.union(v.literal("host"), v.literal("cohost"), v.literal("listener")),
    joinedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_stream", ["streamId"])
    .index("by_user", ["userId"])
    .index("by_stream_and_user", ["streamId", "userId"]),

  chatMessages: defineTable({
    streamId: v.id("streams"),
    userId: v.id("users"),
    message: v.string(),
    timestamp: v.number(),
  })
    .index("by_stream", ["streamId"])
    .index("by_stream_and_timestamp", ["streamId", "timestamp"]),

  webrtcSignals: defineTable({
    streamId: v.id("streams"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    signalType: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    signalData: v.string(),
    timestamp: v.number(),
  })
    .index("by_stream_and_to_user", ["streamId", "toUserId"])
    .index("by_stream", ["streamId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
