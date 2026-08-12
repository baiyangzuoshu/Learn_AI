import { lessonTestCases } from "../desktop/services/lesson_tests.ts";

for (const test of lessonTestCases) {
  Deno.test(test.id, test.run);
}
