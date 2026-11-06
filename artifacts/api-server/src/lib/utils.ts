import { randomInt } from "node:crypto";
const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function nanoid(size = 8): string {
  let out = "";
  for (let i = 0; i < size; i += 1) out += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return out;
}
