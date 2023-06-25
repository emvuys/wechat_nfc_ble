/**
 *错误码定义
 */
function getErrorInfo(code) {
  var errorInfo = '';
  switch (code) {
    case 0x01:
      errorInfo = 'Checksum error';
      break;
    case 0x02:
      errorInfo = 'Timeout';
      break;
    case 0x03:
      errorInfo = 'Command error';
      break;
    case 0x04:
      errorInfo = 'Unauthorized';
      break;
    case 0x05:
      errorInfo = 'Undefined error';
      break;
    case 0x06:
      errorInfo = 'Receive data error';
      break;
    case 0x07:
      errorInfo = 'Exceeded authentication retry error';
      break;
    case 0x08:
      errorInfo = '当前连接已断开';
      break;
    case 0x09:
      errorInfo = '当前特征值不支持此操作';
      break;
    case 0x0A:
      errorInfo = '其余所有系统上报的异常';
      break;
    case 0x0B:
      errorInfo = 'Android 系统特有，系统版本低于 4.3 不支持 BLE';
      break;
    default:
      errorInfo = '其他错误 可能本方法定义的错误码已更新不上官方的错误码 也可能是未知错误';
      break;
  }
  return errorInfo
}

module.exports = {
  getErrorInfo: getErrorInfo
}