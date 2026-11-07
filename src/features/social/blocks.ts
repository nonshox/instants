import "server-only";
import { ID } from "node-appwrite";
import {
  findRelationship,
  findUserByUsername,
  getDatabaseId,
  getTables,
  removeFollowInTransaction,
  runTransaction,
} from "./data";
import {
  SocialError,
  type BlockRow,
  type RelationshipRow,
} from "./types";

export async function blockByUsername(
  viewerId: string,
  username: string,
): Promise<void> {
  const target = await findUserByUsername(username);
  if (!target || target.$id === viewerId) {
    throw new SocialError("PROFILE_NOT_FOUND");
  }

  const [existingBlock, reverseBlock] = await Promise.all([
    findRelationship("blocks", "blocker", viewerId, "blocked", target.$id),
    findRelationship("blocks", "blocker", target.$id, "blocked", viewerId),
  ]);
  if (existingBlock) {
    return;
  }
  if (reverseBlock) {
    throw new SocialError("BLOCKED");
  }

  const [outgoingFollow, incomingFollow, outgoingRequest, incomingRequest] =
    await Promise.all([
      findRelationship<RelationshipRow>(
        "follows",
        "follower",
        viewerId,
        "following",
        target.$id,
      ),
      findRelationship<RelationshipRow>(
        "follows",
        "follower",
        target.$id,
        "following",
        viewerId,
      ),
      findRelationship("requests", "requester", viewerId, "target", target.$id),
      findRelationship("requests", "requester", target.$id, "target", viewerId),
    ]);
  await runTransaction(async (transactionId) => {
    const service = getTables();
    await service.createRow<BlockRow>({
      databaseId: getDatabaseId(),
      tableId: "blocks",
      rowId: ID.unique(),
      permissions: [],
      transactionId,
      data: {
        blocker: viewerId,
        blocked: target.$id,
        created: new Date().toISOString(),
      },
    });

    const removals: Promise<unknown>[] = [];
    if (outgoingRequest) {
      removals.push(
        service.deleteRow({
          databaseId: getDatabaseId(),
          tableId: "requests",
          rowId: outgoingRequest.$id,
          transactionId,
        }),
      );
    }
    if (incomingRequest) {
      removals.push(
        service.deleteRow({
          databaseId: getDatabaseId(),
          tableId: "requests",
          rowId: incomingRequest.$id,
          transactionId,
        }),
      );
    }
    if (outgoingFollow) {
      removals.push(removeFollowInTransaction(outgoingFollow, transactionId));
    }
    if (incomingFollow) {
      removals.push(removeFollowInTransaction(incomingFollow, transactionId));
    }
    await Promise.all(removals);
  });
}

export async function unblockByUsername(
  viewerId: string,
  username: string,
): Promise<void> {
  const target = await findUserByUsername(username);
  if (!target) {
    throw new SocialError("PROFILE_NOT_FOUND");
  }
  const block = await findRelationship(
    "blocks",
    "blocker",
    viewerId,
    "blocked",
    target.$id,
  );
  if (!block) {
    return;
  }
  await getTables().deleteRow({
    databaseId: getDatabaseId(),
    tableId: "blocks",
    rowId: block.$id,
  });
}
