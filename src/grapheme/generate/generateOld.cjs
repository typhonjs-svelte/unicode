const fs = require("fs");
const https = require("https");
const stream = require("stream");

const linesStream = require("@orisano/lines-stream");


(async () => {
   const Module = await import('../../../dist/index.js')
   const UnicodeTrieBuilder = Module.UnicodeTrieBuilder;
   const ClusterBreak = Module.ClusterBreak;

   https.get(
    "https://www.unicode.org/Public/15.0.0/ucd/auxiliary/GraphemeBreakProperty.txt",
    (res) => {
       const { statusCode } = res;
       if (statusCode !== 200) {
          console.error(`failed to request: ${statusCode}`);
          res.resume();
          return;
       }

       const trie = new UnicodeTrieBuilder(ClusterBreak.Other);
       res
       .setEncoding("utf8")
       .pipe(linesStream())
       .pipe(parseLine())
       .on("data", ({ start, end, type }) => {
          trie.setRange(start, end, ClusterBreak[type]);
       })
       .on("end", () => {
          fs.writeFileSync(
           "./typeTrie.json",
           JSON.stringify({
              data: trie.toBuffer().toString("base64"),
           })
          );
       });
    }
   );

   https.get(
    "https://www.unicode.org/Public/15.0.0/ucd/emoji/emoji-data.txt",
    (res) => {
       const { statusCode } = res;
       if (statusCode !== 200) {
          console.error(`failed to request: ${statusCode}`);
          res.resume();
          return;
       }

       const trie = new UnicodeTrieBuilder();
       res
       .setEncoding("utf8")
       .pipe(linesStream())
       .pipe(parseLine())
       .on("data", ({ start, end, type }) => {
          if (type === "Extended_Pictographic")
             trie.setRange(start, end, ClusterBreak.Extended_Pictographic);
       })
       .on("end", () => {
          fs.writeFileSync(
           "./extPict.json",
           JSON.stringify({
              data: trie.toBuffer().toString("base64"),
           })
          );
       });
    }
   );
})();


function parseLine() {
   return new stream.Transform({
      decodeStrings: false,
      readableObjectMode: true,

      transform(line, encoding, callback) {
         const body = line.split("#")[0];
         if (body.trim().length === 0) {
            callback();
            return;
         }
         const [rawRange, type] = body.split(";").map((x) => x.trim());
         const range = rawRange.split("..").map((x) => parseInt(x, 16));
         if (range.length > 1) {
            this.push({ start: range[0], end: range[1], type });
         } else {
            this.push({ start: range[0], end: range[0], type });
         }
         callback();
      },
   });
}
