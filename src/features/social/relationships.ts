import "server-only";
import { AppwriteException, ID } from "node-appwrite";
import {
  addFollow,
  assertNotBlocked,
  findRelationship,
  findUserByUsername,
  getDatabaseId,
  getTables,
  removeFollowInTransaction,
  runTransaction,
} from "./data";
import { SocialError, type RelationshipRow, type RequestRow } from "./types";
import {
  createNotificationInTransaction,
  dispatchTelegramNotification,
} from "@/src/features/notifications/service";

export async function followByUsername(
  viewerId: string,
  username: string,
): Promise<"following" | "requested" | "incoming"> {
  const target = await findUserByUsername(username);
  if (!target || target.$id === viewerId) {
    throw new SocialError("PROFILE_NOT_FOUND");
  }
  await assertNotBlocked(viewerId, target.$id);

  const [follow, outgoingRequest, incomingRequest] = await Promise.all([
    findRelationship<RelationshipRow>(
      "follows",
      "follower",
      viewerId,
      "following",
      target.$id,
    ),
    findRelationship("requests", "requester", viewerId, "target", target.$id),
    findRelationship("requests", "requester", target.$id, "target", viewerId),
  ]);
  if (follow) {
    return "following";
  }
  if (outgoingRequest) {
    return "requested";
  }
  if (incomingRequest) {
    return "incoming";
  }

  if (target.private) {
    try {
      await runTransaction(
        async (transactionId) => {
          await getTables().createRow<RequestRow>({
            databaseId: getDatabaseId(),
            tableId: "requests",
            rowId: ID.unique(),
            permissions: [],
            transactionId,
            data: { requester: viewerId, target: target.$id },
          });
          await createNotificationInTransaction(
            target.$id,
            viewerId,
            "follow_request",
            transactionId,
          );
        },
        "Follow request transaction",
      );
      await dispatchTelegramNotification(target.$id, viewerId, "follow_request");
      return "requested";
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 409) {
        return "requested";
      }
      throw error;
    }
  }

  try {
    await runTransaction(
      async (transactionId) => {
        await addFollow(viewerId, target.$id, transactionId);
        await createNotificationInTransaction(
          target.$id,
          viewerId,
          "new_follower",
          transactionId,
        );
      },
      "Follow transaction",
    );
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      const created = await findRelationship<RelationshipRow>(
        "follows",
        "follower",
        viewerId,
        "following",
        target.$id,
      );
      if (created) {
        return "following";
      }
    }
    throw error;
  }
  await dispatchTelegramNotification(target.$id, viewerId, "new_follower");
  return "following";
}

export async function removeRelationship(
  viewerId: string,
  username: string,
): Promise<void> {
  const target = await findUserByUsername(username);
  if (!target) {
    throw new SocialError("PROFILE_NOT_FOUND");
  }
  const [follow, request] = await Promise.all([
    findRelationship<RelationshipRow>(
      "follows",
      "follower",
      viewerId,
      "following",
      target.$id,
    ),
    findRelationship("requests", "requester", viewerId, "target", target.$id),
  ]);
  if (!follow && !request) {
    return;
  }

  await runTransaction(async (transactionId) => {
    if (request) {
      await getTables().deleteRow({
        databaseId: getDatabaseId(),
        tableId: "requests",
        rowId: request.$id,
        transactionId,
      });
    }
    if (follow) {
      await removeFollowInTransaction(follow, transactionId);
    }
  });
}

export async function removeFollower(
  viewerId: string,
  username: string,
): Promise<void> {
  const follower = await findUserByUsername(username);
  if (!follower) throw new SocialError("PROFILE_NOT_FOUND");
  const follow = await findRelationship<RelationshipRow>(
    "follows",
    "follower",
    follower.$id,
    "following",
    viewerId,
  );
  if (!follow) return;
  await runTransaction((transactionId) =>
    removeFollowInTransaction(follow, transactionId),
  );
}

export async function decideIncomingRequest(
  viewerId: string,
  requesterUsername: string,
  action: "approve" | "reject",
): Promise<void> {
  const requester = await findUserByUsername(requesterUsername);
  if (!requester) {
    throw new SocialError("REQUEST_NOT_FOUND");
  }
  const request = await findRelationship(
    "requests",
    "requester",
    requester.$id,
    "target",
    viewerId,
  );
  if (!request) {
    throw new SocialError("REQUEST_NOT_FOUND");
  }

  await assertNotBlocked(viewerId, requester.$id);
  const existingFollow = await findRelationship<RelationshipRow>(
    "follows",
    "follower",
    requester.$id,
    "following",
    viewerId,
  );
  if (action === "reject" || existingFollow) {
    await getTables().deleteRow({
      databaseId: getDatabaseId(),
      tableId: "requests",
      rowId: request.$id,
    });
    return;
  }

  await runTransaction(async (transactionId) => {
    await getTables().deleteRow({
      databaseId: getDatabaseId(),
      tableId: "requests",
      rowId: request.$id,
      transactionId,
    });
    await addFollow(requester.$id, viewerId, transactionId);
    await createNotificationInTransaction(
      requester.$id,
      viewerId,
      "follow_approved",
      transactionId,
    );
  });
  await dispatchTelegramNotification(
    requester.$id,
    viewerId,
    "follow_approved",
  );
}
