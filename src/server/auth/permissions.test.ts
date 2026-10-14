import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  canChangeRole,
  canInvite,
  canRemoveMember,
  type MemberChange,
} from "./permissions";

const change = (over: Partial<MemberChange> = {}): MemberChange => ({
  actorId: "actor",
  actorRole: "owner",
  targetId: "target",
  targetRole: "setter",
  ownerCount: 1,
  ...over,
});

describe("permisos de equipo", () => {
  it("roles asignables por actor", () => {
    expect(assignableRoles("owner")).toEqual(["owner", "admin", "setter"]);
    expect(assignableRoles("admin")).toEqual(["admin", "setter"]);
    expect(assignableRoles("setter")).toEqual([]);
  });

  it("invitar", () => {
    expect(canInvite("owner", "owner").ok).toBe(true);
    expect(canInvite("admin", "setter").ok).toBe(true);
    expect(canInvite("admin", "owner").ok).toBe(false);
    expect(canInvite("setter", "setter").ok).toBe(false);
  });

  it("un setter no gestiona a nadie", () => {
    expect(canChangeRole(change({ actorRole: "setter" }), "admin").ok).toBe(false);
    expect(canRemoveMember(change({ actorRole: "setter" })).ok).toBe(false);
  });

  it("nadie se cambia el rol a sí mismo", () => {
    expect(
      canChangeRole(change({ targetId: "actor", targetRole: "owner", ownerCount: 2 }), "admin").ok,
    ).toBe(false);
  });

  it("un admin no toca owners ni promueve a owner", () => {
    expect(
      canChangeRole(change({ actorRole: "admin", targetRole: "owner", ownerCount: 2 }), "admin").ok,
    ).toBe(false);
    expect(canChangeRole(change({ actorRole: "admin" }), "owner").ok).toBe(false);
    expect(canChangeRole(change({ actorRole: "admin" }), "admin").ok).toBe(true);
    expect(
      canRemoveMember(change({ actorRole: "admin", targetRole: "owner", ownerCount: 2 })).ok,
    ).toBe(false);
  });

  it("no se puede dejar a la organización sin owner", () => {
    expect(canChangeRole(change({ targetRole: "owner", ownerCount: 1 }), "admin").ok).toBe(false);
    expect(canRemoveMember(change({ targetRole: "owner", ownerCount: 1 })).ok).toBe(false);
    expect(canChangeRole(change({ targetRole: "owner", ownerCount: 2 }), "admin").ok).toBe(true);
    expect(canRemoveMember(change({ targetRole: "owner", ownerCount: 2 })).ok).toBe(true);
  });
});
