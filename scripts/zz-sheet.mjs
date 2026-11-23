import sharp from "sharp"; import fs from "node:fs";
const [,, dir, suffix, out] = process.argv;
const files = fs.readdirSync(dir).filter(f => f.endsWith(suffix)).sort();
const W = suffix.includes("mobile") ? 260 : 480, H = suffix.includes("mobile") ? 563 : 300, cols = suffix.includes("mobile") ? 5 : 3;
const comps = await Promise.all(files.map(async (f, i) => ({ input: await sharp(`${dir}/${f}`).resize(W, H, { fit: "cover", position: "top" }).png().toBuffer(), left: 10 + (i % cols) * (W + 10), top: 10 + Math.floor(i / cols) * (H + 10) })));
const rows = Math.ceil(files.length / cols);
await sharp({ create: { width: cols * (W + 10) + 10, height: rows * (H + 10) + 10, channels: 4, background: "#888" } }).composite(comps).png().toFile(out);
console.log(files.join(" | "));
