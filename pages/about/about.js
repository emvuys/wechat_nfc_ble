Page({
    data: {
        textLog: "",
    },

    onLoad() {

        // 在页面中定义激励视频广告
        // let videoAd = null
        //
        // // 在页面onLoad回调事件中创建激励视频广告实例
        // if (wx.createRewardedVideoAd) {
        //     videoAd = wx.createRewardedVideoAd({
        //         adUnitId: 'adunit-a3c7ad52867c718c'
        //     })
        //     videoAd.onLoad(() => {})
        //     videoAd.onError((err) => {})
        //     videoAd.onClose((res) => {})
        // }
        //
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

    },

    about(){
        wx.navigateTo({
            url: '../show/show'
        })
    }


});
