
// 在页面中定义激励视频广告
let videoAd = null


Page({
    data: {
        flag: false,
    },
    onLoad(options){
        let json =options.item;
        console.log("show:"+json);
        if(json == 1){
            this.setData({
                flag: true
            })
        }else{
            // 在页面onLoad回调事件中创建激励视频广告实例
            if (wx.createRewardedVideoAd) {
                videoAd = wx.createRewardedVideoAd({
                    adUnitId: 'adunit-a3c7ad52867c718c'
                })
                videoAd.onLoad(() => {

                })
                videoAd.onError((err) => {

                })
                videoAd.onClose((res) => {
                    //判断用户是否将广告播放完成，则跳转至目标页面或者其它后续功能
                    if(res.isEnded){
                        setTimeout(function(){
                            wx.redirectTo({
                                url:'/pages/show/show?item=1'
                            })
                        },800);
                    }else{
                        //判断用户是否将广告播放完成，没有则跳转返回上一页
                        wx.showModal({
                            title: '提示',
                            content: '视频没有播放完，请重新尝试！',
                            showCancel:false,
                            complete: (res) => {
                                if (res.cancel) {
                                    this.setData({
                                        flag: false
                                    })
                                }

                                if (res.confirm) {
                                    wx.navigateBack({
                                        delta:1
                                    })
                                }
                            }
                        })

                    }
                })
            }

            // // 用户触发广告后，显示激励视频广告
            // if (videoAd) {
            //     videoAd.show().catch(() => {
            //         // 失败重试
            //         videoAd.load()
            //             .then(() => videoAd.show())
            //             .catch(err => {
            //                 console.log('激励视频 广告显示失败')
            //             })
            //     })
            // }
        }
    },

    about(){
        // wx.navigateTo({
        //     url: '../show/show'
        // })

          // 用户触发广告后，显示激励视频广告
          if (videoAd) {
            videoAd.show().catch(() => {
                // 失败重试
                videoAd.load()
                    .then(() => videoAd.show())
                    .catch(err => {
                        console.log('激励视频 广告显示失败')
                    })
            })
        }
    }

});
