import { inflateSync }     from '#runtime/data/compress';

import { Const }           from './Constants';
import { Swap32LE }        from './Swap32LE';

export class UnicodeTrie
{
   readonly #data: Uint32Array;

   readonly #errorValue: number;

   readonly #highStart: number;

   constructor(data)
   {
      const isBuffer = (typeof data.readUInt32BE === 'function') && (typeof data.slice === 'function');

      if (isBuffer || data instanceof Uint8Array)
      {
         // read binary format
         if (isBuffer)
         {
            this.#highStart = data.readUInt32LE(0);
            this.#errorValue = data.readUInt32LE(4);
            data = data.slice(12);
         }
         else
         {
            const view = new DataView(data.buffer);
            this.#highStart = view.getUint32(0, true);
            this.#errorValue = view.getUint32(4, true);
            data = data.subarray(12);
         }

         // Double inflate the actual trie data.
         data = inflateSync(data);
         data = inflateSync(data);

         // Swap bytes from little-endian.
         Swap32LE.swap(data);

// console.log(`!!! UnicodeTrie - ctor - 0 - data.buffer length: ${data.buffer.length}; length % 4: ${data.buffer.length % 4}`)
console.log(`!!! UnicodeTrie - ctor - 0 - data: `, data)

         this.#data = new Uint32Array(data.buffer);
      }
      else
      {
         // pre-parsed data
         ({ data: this.#data, highStart: this.#highStart, errorValue: this.#errorValue } = data);
      }
   }

   /**
    * @returns {Uint32Array} The data array.
    */
   get data() { return this.#data; }

   /**
    * @returns {number} The error value.
    */
   get errorValue() { return this.#errorValue; }

   /**
    * @returns {number} The high start.
    */
   get highStart() { return this.#highStart; }

   get(codePoint)
   {
      if ((codePoint < 0) || (codePoint > 0x10ffff)) { return this.#errorValue; }

      let index;

      if ((codePoint < 0xd800) || ((codePoint > 0xdbff) && (codePoint <= 0xffff)))
      {
         // Ordinary BMP code point, excluding leading surrogates.
         // BMP uses a single level lookup.  BMP index starts at offset 0 in the index.
         // data is stored in the index array itself.
         index = (this.#data[codePoint >> Const.SHIFT_2] << Const.INDEX_SHIFT) + (codePoint & Const.DATA_MASK);

         return this.#data[index];
      }

      if (codePoint <= 0xffff)
      {
         // Lead Surrogate Code Point.  A Separate index section is stored for
         // lead surrogate code units and code points.
         //   The main index has the code unit data.
         //   For this function, we need the code point data.
         index = (this.#data[Const.LSCP_INDEX_2_OFFSET +
          ((codePoint - 0xd800) >> Const.SHIFT_2)] << Const.INDEX_SHIFT) +
           (codePoint & Const.DATA_MASK);

         return this.#data[index];
      }

      if (codePoint < this.#highStart) {
         // Supplemental code point, use two-level lookup.
         index = this.#data[(Const.INDEX_1_OFFSET - Const.OMITTED_BMP_INDEX_1_LENGTH) + (codePoint >> Const.SHIFT_1)];

         index = this.#data[index + ((codePoint >> Const.SHIFT_2) & Const.INDEX_2_MASK)];

         index = (index << Const.INDEX_SHIFT) + (codePoint & Const.DATA_MASK);

         return this.#data[index];
      }

      return this.#data[this.#data.length - Const.DATA_GRANULARITY];
   }
}
