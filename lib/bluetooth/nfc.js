// 获取nfc实例
function nfc() {
  const nfc = wx.getNFCAdapter()
  this.nfc = nfc
  let _this = this

  function discoverHandler(res) {
      const data = new Uint8Array(res.id)
      let str = ""
      data.forEach(e => {
          let item = e.toString(16)
          if (item.length == 1) {
              item = '0' + item
          }
          item = item.toUpperCase()
          str += item
      })
      _this.setData({
          newCardCode: str
      })
      wx.showToast({
          title: '读取成功！',
          icon: 'none'
      })
  }
  nfc.startDiscovery({
      success(res) {
          wx.showToast({
              title: 'NFC读取功能已开启！',
              icon: 'none'
          })
          nfc.onDiscovered(discoverHandler)
      },
      fail(err) {if(!err.errCode){
            wx.showToast({
              title: '请检查NFC功能是否正常!',
              icon: 'none'
            })
            return
          }
          switch (err.errCode) {
              case 13000:
                wx.showToast({
                  title: '设备不支持NFC!',
                  icon: 'none'
                })
                break;
              case 13001:
                wx.showToast({
                  title: '系统NFC开关未打开!',
                  icon: 'none'
                })
                break;
              case 13019:
                wx.showToast({
                  title: '用户未授权!',
                  icon: 'none'
                })
                break;
              case 13010:
                wx.showToast({
                  title: '未知错误!',
                  icon: 'none'
                })
                break;
            }
      }
  })
}

module.exports = {
  nfc,
}