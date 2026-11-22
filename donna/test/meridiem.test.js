import test from "node:test";
import assert from "node:assert/strict";
import { readMeridiem, settleMeridiem } from "../src/lib/meridiem.js";

// Sun 2099-01-04.
const at = (hour, minute = 0) => new Date(2099, 0, 4, hour, minute);

test("an hour whose morning has gone means the evening", () => {
  assert.deepEqual(readMeridiem("i wanna go gym today at 7", at(10)), { text: "i wanna go gym today at 7pm" });
});

test("with no day named, a bare hour still means today", () => {
  assert.deepEqual(readMeridiem("gym at 7", at(10)), { text: "gym at 7pm" });
});

test("minutes are kept when the half is added", () => {
  assert.deepEqual(readMeridiem("gym at 7:30 today", at(10)), { text: "gym at 7:30pm today" });
});

test("when both halves are still ahead, she asks rather than guessing", () => {
  assert.deepEqual(readMeridiem("gym today at 7", at(5)), { ask: "7am or 7pm?" });
  assert.deepEqual(readMeridiem("gym tmrw at 7:30", at(10)), { ask: "7:30am or 7:30pm?" });
  assert.deepEqual(readMeridiem("lecture friday at 9", at(10)), { ask: "9am or 9pm?" });
});

test("nobody books three in the morning, so 1 to 6 is afternoon", () => {
  assert.deepEqual(readMeridiem("call mum tmrw at 3", at(10)), { text: "call mum tmrw at 3pm" });
});

test("a time that already says which half is left alone", () => {
  for (const said of ["gym at 7pm", "gym at 7am tmrw", "gym at 19:00", "gym tonight at 7", "gym at 7 in the evening", "gym in the morning at 7"]) {
    assert.equal(readMeridiem(said, at(5)), null, said);
  }
});

test("twelve is noon, and messages with no time are left alone", () => {
  assert.equal(readMeridiem("lunch at 12", at(5)), null);
  assert.equal(readMeridiem("when am i free tmrw", at(5)), null);
  assert.equal(readMeridiem("lowk wanna learn rust 30 mins a day for 2 wks", at(5)), null);
});

test("when both halves have gone today there is nothing to read into it", () => {
  assert.equal(readMeridiem("gym today at 7", at(20)), null);
});

test("the answer to am or pm completes the original message", () => {
  const original = "gym today at 7";
  for (const [reply, half] of [["pm", "pm"], ["PM", "pm"], ["7pm", "pm"], ["evening", "pm"], ["at night", "pm"], ["am", "am"], ["7 am", "am"], ["morning", "am"], ["in the morning pls", "am"]]) {
    assert.equal(settleMeridiem(original, reply, at(5)), `gym today at 7${half}`, reply);
  }
});

test("anything other than an answer is a new message", () => {
  for (const reply of ["actually move my night class", "8pm", "i am", "nvm"]) {
    assert.equal(settleMeridiem("gym today at 7", reply, at(5)), null, reply);
  }
});

test("o'clock keeps its place, and the half goes after it", () => {
  assert.deepEqual(readMeridiem("meet at 7 o'clock", at(10)), { text: "meet at 7 o'clock pm" });
});

test("the half goes after the hour, not after a date that shares its number", () => {
  assert.equal(settleMeridiem("gym on 11/7 at 7", "pm", at(5)), "gym on 11/7 at 7pm");
  assert.equal(settleMeridiem("gym November 7 at 7", "pm", at(5)), "gym November 7 at 7pm");
  assert.equal(settleMeridiem("gym at 7 on 11/7", "pm", at(5)), "gym at 7pm on 11/7");
  assert.equal(settleMeridiem("gym on the 7th at 7", "pm", at(5)), "gym on the 7th at 7pm");
  assert.deepEqual(readMeridiem("gym at 7.", at(10)), { text: "gym at 7pm." });
});
