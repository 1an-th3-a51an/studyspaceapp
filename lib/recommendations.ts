import { DEMO_RECOMMENDATIONS } from "@/lib/demo/handsomeDan";
import type { RoomPrefs, StudyRecommendation } from "@/lib/types";

const YALE_ROOM_URL = "https://schedule.yale.edu/space/36623";

export function recommendSpaces(prefs: RoomPrefs): {
  primary: StudyRecommendation;
  rest: StudyRecommendation[];
} {
  const coffee = DEMO_RECOMMENDATIONS.filter((item) => item.kind === "coffee");
  const rooms = DEMO_RECOMMENDATIONS.filter((item) => item.kind === "room");
  const yaleRoom =
    rooms.find((item) => item.bookingUrl === YALE_ROOM_URL) ??
    rooms[0] ?? {
      kind: "room" as const,
      name: "Bass Library Group Study",
      walkingMinutes: 6,
      bookingUrl: YALE_ROOM_URL,
    };

  const nearbyCoffee = coffee.filter(
    (shop) => shop.walkingMinutes <= prefs.maxExtraWalkingMinutes,
  );
  const useCoffee =
    prefs.includeCoffeeShops &&
    prefs.examUrgency < 0.85 &&
    nearbyCoffee.length > 0;

  const ordered: StudyRecommendation[] = useCoffee
    ? [...nearbyCoffee, yaleRoom, ...rooms.filter((room) => room !== yaleRoom)]
    : [yaleRoom, ...rooms.filter((room) => room !== yaleRoom)];

  const unique: StudyRecommendation[] = [];
  for (const item of ordered) {
    if (!unique.some((existing) => existing.name === item.name)) {
      unique.push(item);
    }
  }

  return { primary: unique[0], rest: unique.slice(1) };
}
