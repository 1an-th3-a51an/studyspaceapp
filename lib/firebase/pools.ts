import type { StudyPool } from "@/lib/types";

export async function listPoolsByCourseCode(
  _courseCode: string,
): Promise<StudyPool[]> {
  void _courseCode;
  throw new Error("Seed DB not wired");
}

export async function hostPool(_input: {
  deviceId: string;
  courseCode: string;
  hostDisplayName: string;
  targetGroupSize: 1 | 2 | 3 | 4;
}): Promise<StudyPool> {
  void _input;
  throw new Error("Seed DB not wired");
}

export async function joinPool(_input: {
  deviceId: string;
  poolId: string;
}): Promise<StudyPool> {
  void _input;
  throw new Error("Seed DB not wired");
}
