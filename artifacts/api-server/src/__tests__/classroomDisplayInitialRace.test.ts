import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateClassroomDisplayClient,
  addClassroomDisplayClient,
  broadcastToClass,
  removeClassroomDisplayClient,
  type ClassroomDisplayClient,
} from "../services/classroomDisplayAlerts";

describe("classroom display initial registration race", () => {
  const clients: Array<{ classId: number; client: ClassroomDisplayClient }> = [];
  afterEach(() => {
    for (const { classId, client } of clients) removeClassroomDisplayClient(classId, client);
    clients.length = 0;
  });

  it("suppresses pre-init broadcasts and activation schedules the newer refresh", async () => {
    const writes: string[] = [];
    const client: ClassroomDisplayClient = {
      displayToken: "unused-while-unready",
      ready: false,
      res: { write: vi.fn((value: string) => writes.push(value)), end: vi.fn() },
    };
    clients.push({ classId: 991, client });
    addClassroomDisplayClient(991, client);

    await broadcastToClass(991, { type: "refresh", queue: ["mutation-between-register-and-init"] });
    expect(writes).toEqual([]);

    client.res.write('data: {"type":"init","queue":[]}\n\n');
    const reconcile = vi.fn(() => {
      client.res.write('data: {"type":"refresh","queue":["newer"]}\n\n');
    });
    activateClassroomDisplayClient(991, client, reconcile);

    expect(reconcile).toHaveBeenCalledWith(991);
    expect(writes).toEqual([
      'data: {"type":"init","queue":[]}\n\n',
      'data: {"type":"refresh","queue":["newer"]}\n\n',
    ]);
  });
});