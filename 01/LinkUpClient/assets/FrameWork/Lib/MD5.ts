/* eslint-disable @typescript-eslint/no-extraneous-class */

export class MD5 {
    private static rotateLeft(lValue: number, iShiftBits: number): number {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }

    private static addUnsigned(lX: number, lY: number): number {
        const lX4 = lX & 0x40000000;
        const lY4 = lY & 0x40000000;
        const lX8 = lX & 0x80000000;
        const lY8 = lY & 0x80000000;
        const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) {
            return lResult ^ 0x80000000 ^ lX8 ^ lY8;
        }
        if (lX4 | lY4) {
            if (lResult & 0x40000000) {
                return lResult ^ 0xC0000000 ^ lX8 ^ lY8;
            } else {
                return lResult ^ 0x40000000 ^ lX8 ^ lY8;
            }
        } else {
            return lResult ^ lX8 ^ lY8;
        }
    }

    private static F(x: number, y: number, z: number): number {
        return (x & y) | (~x & z);
    }

    private static G(x: number, y: number, z: number): number {
        return (x & z) | (y & ~z);
    }

    private static H(x: number, y: number, z: number): number {
        return x ^ y ^ z;
    }

    private static I(x: number, y: number, z: number): number {
        return y ^ (x | ~z);
    }

    // eslint-disable-next-line @typescript-eslint/max-params
    private static FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
        a = MD5.addUnsigned(a, MD5.addUnsigned(MD5.F(b, c, d), MD5.addUnsigned(x, ac)));
        return MD5.addUnsigned(MD5.rotateLeft(a, s), b);
    }

    // eslint-disable-next-line @typescript-eslint/max-params
    private static GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
        a = MD5.addUnsigned(a, MD5.addUnsigned(MD5.G(b, c, d), MD5.addUnsigned(x, ac)));
        return MD5.addUnsigned(MD5.rotateLeft(a, s), b);
    }

    // eslint-disable-next-line @typescript-eslint/max-params
    private static HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
        a = MD5.addUnsigned(a, MD5.addUnsigned(MD5.H(b, c, d), MD5.addUnsigned(x, ac)));
        return MD5.addUnsigned(MD5.rotateLeft(a, s), b);
    }

    // eslint-disable-next-line @typescript-eslint/max-params
    private static II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number {
        a = MD5.addUnsigned(a, MD5.addUnsigned(MD5.I(b, c, d), MD5.addUnsigned(x, ac)));
        return MD5.addUnsigned(MD5.rotateLeft(a, s), b);
    }

    private static convertToWordArray(string: string): number[] {
        let lWordCount;
        const lMessageLength = string.length;
        const lNumberOfWordsTemp1 = lMessageLength + 8;
        const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
        const lWordArray: number[] = new Array(lNumberOfWords - 1).fill(0);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition)) >>> 0;
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }

    private static wordToHex(lValue: number): string {
        let WordToHexValue = "", WordToHexValueTemp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValueTemp = "0" + lByte.toString(16);
            WordToHexValue += WordToHexValueTemp.substr(WordToHexValueTemp.length - 2, 2);
        }
        return WordToHexValue;
    }

    private static md5(string: string): string {
        const x = MD5.convertToWordArray(string);
        let a = 0x67452301;
        let b = 0xEFCDAB89;
        let c = 0x98BADCFE;
        let d = 0x10325476;

        for (let k = 0; k < x.length; k += 16) {
            const AA = a;
            const BB = b;
            const CC = c;
            const DD = d;

            a = MD5.FF(a, b, c, d, x[k + 0], 7, 0xD76AA478);
            d = MD5.FF(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
            c = MD5.FF(c, d, a, b, x[k + 2], 17, 0x242070DB);
            b = MD5.FF(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
            a = MD5.FF(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
            d = MD5.FF(d, a, b, c, x[k + 5], 12, 0x4787C62A);
            c = MD5.FF(c, d, a, b, x[k + 6], 17, 0xA8304613);
            b = MD5.FF(b, c, d, a, x[k + 7], 22, 0xFD469501);
            a = MD5.FF(a, b, c, d, x[k + 8], 7, 0x698098D8);
            d = MD5.FF(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
            c = MD5.FF(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
            b = MD5.FF(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
            a = MD5.FF(a, b, c, d, x[k + 12], 7, 0x6B901122);
            d = MD5.FF(d, a, b, c, x[k + 13], 12, 0xFD987193);
            c = MD5.FF(c, d, a, b, x[k + 14], 17, 0xA679438E);
            b = MD5.FF(b, c, d, a, x[k + 15], 22, 0x49B40821);

            a = MD5.GG(a, b, c, d, x[k + 1], 5, 0xF61E2562);
            d = MD5.GG(d, a, b, c, x[k + 6], 9, 0xC040B340);
            c = MD5.GG(c, d, a, b, x[k + 11], 14, 0x265E5A51);
            b = MD5.GG(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
            a = MD5.GG(a, b, c, d, x[k + 5], 5, 0xD62F105D);
            d = MD5.GG(d, a, b, c, x[k + 10], 9, 0x02441453);
            c = MD5.GG(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
            b = MD5.GG(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
            a = MD5.GG(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
            d = MD5.GG(d, a, b, c, x[k + 14], 9, 0xC33707D6);
            c = MD5.GG(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
            b = MD5.GG(b, c, d, a, x[k + 8], 20, 0x455A14ED);
            a = MD5.GG(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
            d = MD5.GG(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
            c = MD5.GG(c, d, a, b, x[k + 7], 14, 0x676F02D9);
            b = MD5.GG(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);

            a = MD5.HH(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
            d = MD5.HH(d, a, b, c, x[k + 8], 11, 0x8771F681);
            c = MD5.HH(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
            b = MD5.HH(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
            a = MD5.HH(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
            d = MD5.HH(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
            c = MD5.HH(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
            b = MD5.HH(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
            a = MD5.HH(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
            d = MD5.HH(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
            c = MD5.HH(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
            b = MD5.HH(b, c, d, a, x[k + 6], 23, 0x04881D05);
            a = MD5.HH(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
            d = MD5.HH(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
            c = MD5.HH(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
            b = MD5.HH(b, c, d, a, x[k + 2], 23, 0xC4AC5665);

            a = MD5.II(a, b, c, d, x[k + 0], 6, 0xF4292244);
            d = MD5.II(d, a, b, c, x[k + 7], 10, 0x432AFF97);
            c = MD5.II(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
            b = MD5.II(b, c, d, a, x[k + 5], 21, 0xFC93A039);
            a = MD5.II(a, b, c, d, x[k + 12], 6, 0x655B59C3);
            d = MD5.II(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
            c = MD5.II(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
            b = MD5.II(b, c, d, a, x[k + 1], 21, 0x85845DD1);
            a = MD5.II(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
            d = MD5.II(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
            c = MD5.II(c, d, a, b, x[k + 6], 15, 0xA3014314);
            b = MD5.II(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
            a = MD5.II(a, b, c, d, x[k + 4], 6, 0xF7537E82);
            d = MD5.II(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
            c = MD5.II(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
            b = MD5.II(b, c, d, a, x[k + 9], 21, 0xEB86D391);

            a = MD5.addUnsigned(a, AA);
            b = MD5.addUnsigned(b, BB);
            c = MD5.addUnsigned(c, CC);
            d = MD5.addUnsigned(d, DD);
        }

        return MD5.wordToHex(a) + MD5.wordToHex(b) + MD5.wordToHex(c) + MD5.wordToHex(d);
    }

    public static getMD5(input: string): string {
        return MD5.md5(input);
    }
}