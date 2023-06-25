const CryptoJS = require('../../lib/bluetooth/aes.js');
// var util = require('base64.js');
// const key = CryptoJS.enc.Hex.parse("41435231323535552D4A312041757468");//"ACR1255U-J1 Auth"
const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');//iv

/**
 * @return {string}
 */
function Encrypt(word,strKey) {
    let enKey = CryptoJS.enc.Hex.parse(strKey);
    let encryptedHexStr = CryptoJS.enc.Hex.parse(word);
    let encryptedStr = CryptoJS.AES.encrypt(encryptedHexStr, enKey, { iv: iv,padding: CryptoJS.pad.NoPadding});
    return encryptedStr.ciphertext.toString().toUpperCase();
}

function Decrypt(word,strKey) {
    let encryptedHexStr = CryptoJS.enc.Hex.parse(word);

    let key = CryptoJS.enc.Hex.parse(strKey);
    let encrypted = {};
    encrypted.key=key;
    encrypted.iv=iv;
    encrypted.ciphertext = encryptedHexStr;

    let decrypted = CryptoJS.AES.decrypt(encrypted, key, { iv: iv, padding: CryptoJS.pad.NoPadding });
    let decryptedStr = CryptoJS.enc.Hex.stringify(decrypted);
    return decryptedStr;
}

module.exports = {
  Encrypt: Encrypt,
  Decrypt: Decrypt,
}
