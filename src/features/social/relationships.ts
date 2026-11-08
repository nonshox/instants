import "server-only";
import { AppwriteException, ID } from "node-appwrite";
import {
  addLink,
  assertNotBlocked,
  findLink,
  findRelationship,
  findUserByUsername,
  getDatabaseId,
  getTables,
  removeLinkInTransaction,
  runTransaction,
} from "./data";
import { SocialError, type RequestRow } from "./types";
import {
  createNotificationInTransaction,
  dispatchTelegramNotification,
} from "@/src/features/notifications/service";

export type LinkStatus = "linked" | "requested";

/**
 * One user asks to link. The other user must accept before anything is shared.
 * If the other user already asked, this call accepts their request instead of
 * creating a second pending row.
 */
export async function linkByUsername(
  viewerId: string,
  username: string,
): Promise<LinkStatus> {
  const target = await findUserByUsername(username);
  if (!target || target.$id === viewerId) {
    throw new SocialError("PROFILE_NOT_FOUND");
  }
  await assertNotBlocked(viewerId, target.$id);

  const [link, outgoingRequest, incomingRequest] = await Promise.all([
    findLink(viewerId, target.$id),
    findRelationship("requests", "requester", viewerId, "target", target.$id),
    findRelationship("requests", "requester", target.$id, "target", viewerId),
  ]);
  if (link) {
    return "linked";
  }
  if (outgoingRequest) {
    return "requested";
  }
  if (incomingRequest) {
    await decideIncomingRequest(viewerId, target.username, "approve");
    return "linked";
  }

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
          "link_request",
          transactionId,
        );
      },
      "Link request transaction",
    );
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      const concurrent = await findLink(viewerId, target.$id);
      return concurrent ? "linked" : "requested";
    }
    throw error;
  }

  await dispatchTelegramNotification(target.$id, viewerId, "link_request");
  return "requested";
}

/** Removes an existing link or cancels the viewer's outgoing link request. */
export async function unlinkByUsername(
  viewerId: string,
  username: string,
): Promise<void> {
  const target = await findUserByUsername(username);
  if (!target) {
    throw new SocialError("PROFILE_NOT_FOUND");
  }
  const [link, outgoingRequest] = await Promise.all([
    findLink(viewerId, target.$id),
    findRelationship("requests", "requester", viewerId, "target", target.$id),
  ]);
  if (!link && !outgoingRequest) {
    return;
  }

  await runTransaction(
    async (transactionId) => {
      if (outgoingRequest) {
        await getTables().deleteRow({
          databaseId: getDatabaseId(),
          tableId: "requests",
          rowId: outgoingRequest.$id,
          transactionId,
        });
      }
      if (link) {
        await removeLinkInTransaction(link, transactionId);
      }
    },
    "Unlink transaction",
  );
}

/**
 * Approving creates the single mutual link row and clears any reverse request.
 * Rejecting only deletes the pending request.
 */
export async function decideIncomingRequest(
  viewerId: string,
  requesterUsername: string,
  action: "approve" | "reject",
): Promise<void> {
  const requester = await findUserByUsername(requesterUsername);
  if (!requester) {
    throw new SocialError("REQUEST_NOT_FOUND");
  }
  const request = await findRelationship<RequestRow>(
    "requests",
    "requester",
    requester.$id,
    "target",
    viewerId,
  );
  if (!request) {
    throw new SocialError("REQUEST_NOT_FOUND");
  }

  if (action === "reject") {
    await getTables().deleteRow({
      databaseId: getDatabaseId(),
      tableId: "requests",
      rowId: request.$id,
    });
    return;
  }

  await assertNotBlocked(viewerId, requester.$id);
  const [link, reverseRequest] = await Promise.all([
    findLink(requester.$id, viewerId),
    findRelationship(
      "requests",
      "requester",
      viewerId,
      "target",
      requester.$id,
    ),
  ]);

  try {
    await runTransaction(
      async (transactionId) => {
        await getTables().deleteRow({
          databaseId: getDatabaseId(),
          tableId: "requests",
          rowId: request.$id,
          transactionId,
        });
        if (reverseRequest) {
          await getTables().deleteRow({
            databaseId: getDatabaseId(),
            tableId: "requests",
            rowId: reverseRequest.$id,
            transactionId,
          });
        }
        if (!link) {
          await addLink(requester.$id, viewerId, transactionId);
        }
        await createNotificationInTransaction(
          requester.$id,
          viewerId,
          "link_accepted",
          transactionId,
        );
      },
      "Accept link transaction",
    );
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      const created = await findLink(requester.$id, viewerId);
      if (created) {
        return;
      }
    }
    throw error;
  }

  await dispatchTelegramNotification(
    requester.$id,
    viewerId,
    "link_accepted",
  );
}
