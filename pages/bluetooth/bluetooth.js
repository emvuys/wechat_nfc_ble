/*
protocol:

Start byte  	1  Value: 05h
Len  			    2  Len means the number of bytes in the Datablock field
Frame Format 	X
				command:
					CmdMessageType  1  Commands
					Length  		2  Data length (Big Endian)
					Slot  			1  Default value: 00h
					Seq  			1  Sequence
					Param  			1  Parameter
					Checksum  		1  Checksum
					Data  			0-N  Data

				response:
					RspMessageType  	1  Response
					Length  			2  Data length (Big Endian)
					Slot  				1  Default value: 00h
					Seq  				1  Sequence
					Slot Status/Param   1  Slot Status/Parameter
				    Checksum  			1  Checksum
					Data  				0-N  Data

			checksum: XOR {RspMessageType, Length, Slot, Seq,SlotStatus/Param, Data

Check  			1  Check means the XOR values of bytes in Len and Datablock fields
Stop byte  		1  Value: 0Ah
*/
const acsUtil = require('../../lib/bluetooth/acsUtils.js');
const CryptoJS = require('../../lib/bluetooth/util')//这里的路径是你放util.js的路径
const ErrorInfo = require('../../lib/bluetooth/errorinfo.js')

// 初始化蓝牙(判断用户有没有开蓝牙) --> 搜索蓝牙 --> 连接蓝牙 --> 根据连接的deviceId获取服务serviceUUID -->
// 根据服务serviceUUID获取特征值 --> 根据特征值获取 读写权限 --> 根据读写 数据交互

let sessionKey = '';
let randB = '';
let strATR = '';
let authed = false;
let cmdType = '6F';
let respFlag = false;
var onSendSuccessCallBack = undefined;
// 在页面中定义插屏广告
let interstitialAd = null

Page({
    data: {
        readerName: 'ACR1311U',
        // findOk: false,
        btName: '',
        select: false,
        select1: false,
        select2: false,
        selectFlag: false,
        searchFlag:false,
        grade_name:  '-点击搜索后,请选择设备-',
        grade_name1: '-选择对应蓝牙设备的服务ID-',
        grade_name2: '-选择对应蓝牙服务的特征ID-',
        bluetoothReaderID: '',
        openBluetoothAdapter: false,
        available: false,
        discovering: false,
        deviceList: [],
        connected: false,
        connectingDeviceId: '',
        btServerUUIDFFF0: '',
        btServerUUID180F: '',
        btServerUUID180A: '',
        btCharacteristicsFFF0: '',
        btCharacteristics180F: '',
        btCharacteristics180A: '',
        btWriteCharacteristics: '',
        btNotifyCharacteristics: '',
        btRdNyCharacteristics: '',
        characteristic_UUID: '',
        strBtResponse: '',
        // readerInfo: {
        //     systemID: '',
        //     modelNumber: '',
        //     serialNumber: '',
        //     fwVersion: '',
        //     manufacturerName: '',
        //     batteryLevel: ''
        // },
        defaults: {
            sendCommend: "",
            onSuccessCallBack: function successCallBack(res) { },
            onFailCallBack: function failCallBack(res) { },
            onCompleteCallBack: function completeCallBack(res) { },
        },
        AuthenticationFlag : false,
        CardStatus:false,
        CardPowerOn:false,   //1.1
        ReadUIDFlag:false,
        CardATR:'',
        CardUID:'',    //1.1
        APDU_Response:'',
        placeholder: '',
        deviceServiceID: [],
        selectServiceID: '',
        deviceCharID: [],
        selectCharID: '',
        bleProp: [],
        selectProp: '',
        asciiData: '',
    },

    onLoad() {

      // 在页面onLoad回调事件中创建插屏广告实例
      if (wx.createInterstitialAd) {
        interstitialAd = wx.createInterstitialAd({
            adUnitId: 'adunit-e7ffedd807403df0'
        })
        interstitialAd.onLoad(() => {})
        interstitialAd.onError((err) => {})
        interstitialAd.onClose(() => {})
    }

        wx.getLocation({
            success: function (res) {
                console.log(res);
            }
        });
        
        wx.getSetting({
          success(res) {
            console.log(res.authSetting)
            //判断是否有'scope.bluetooth'属性
            if (res.authSetting.hasOwnProperty('scope.bluetooth')) {
              //'scope.bluetooth'属性存在，且为false
              if (!res.authSetting['scope.bluetooth']) {
                //弹窗授权
                wx.openSetting({
                  success(res) {
                    console.log(res.authSetting)
                  }
                })
              }
            }
            else
              //'scope.bluetooth'属性不存在，需要授权
              wx.authorize({
                scope: 'scope.bluetooth',
                success() {
                  // 用户已经同意小程序使用手机蓝牙功能，后续调用 蓝牙 接口不会弹窗询问
                  console.log(res.authSetting)
                }
              })
           }
        })

        // 初始化蓝牙
        authed = false;
        this.openBluetooth();
    },

    onShow() {
        // 在适合的场景显示插屏广告
        if (interstitialAd) {
            interstitialAd.show().catch((err) => {
                console.error(err)
            })
        }
    },

    onUnload(){
        this.closeConnection();
    },

    about(){
        // 停止搜寻附近的蓝牙外围设备
        this.stopDiscovery();

        wx.navigateTo({
            url: '../about/about'
        })
    },

    cleanDispay(){
        this.setData({
            CardATR:'',
            APDU_Response:'',
            CardUID: '',    //1.1
            deviceServiceID: [],
            selectServiceID: '',
            deviceCharID: [],
            selectCharID: '',
            bleProp: [],
            selectProp: '',
            asciiData: '',
            connectingDeviceId: ''
        })
    },

    bindShowMsg() {
        this.setData({
            select: !this.data.select
        })
    },

    mySelect(e) {
        let that = this;
        console.log(e);
        var name = e.currentTarget.dataset.name;
         console.log(e.currentTarget.dataset.name);
         console.log(e.currentTarget.dataset.deviceid);


        // 断开与低功耗蓝牙设备的连接 然后再连接新的设备
        if(this.data.connected){
            this.closeConnection(this.data.connectingDeviceId);
        }

        that.setData({
          searchFlag: false,
        });

        this.setData({
            grade_name: name,
            btName: name,
            select: false,
            // findOk: false,
            selectFlag: true,
            discovering: false,
            bluetoothReaderID: e.currentTarget.dataset.deviceid,
            APDU_Response:'',
            deviceServiceID: [],
            selectServiceID: '',
            deviceCharID: [],
            selectCharID: '',
            bleProp: [],
            selectProp: '',
            asciiData: '',
            connectingDeviceId: ''
        })
        console.log("Select BTID = " + this.data.bluetoothReaderID);
    },

    bindShowMsg1() {
        this.setData({
            select1: !this.data.select1
        })
    },

    mySelect1(e) {
        let that = this;
        console.log(e);
        let name = e.currentTarget.dataset.deviceserviceid;
        console.log(e.currentTarget.dataset.deviceserviceid);

        that.setData({
            searchFlag: false,
        });

        this.setData({
            grade_name1: name,
            select1: false,
            // findOk: false,
            selectFlag: true,
            discovering: false,
            selectServiceID: e.currentTarget.dataset.deviceserviceid
        })
        console.log("Select ServiceID = " + this.data.selectServiceID);
        //getCharacteristics
        that.getCharacteristics(this.data.bluetoothReaderID, this.data.selectServiceID);

    },

    bindShowMsg2() {
        this.setData({
            select2: !this.data.select2
        })
    },

    mySelect2(e) {
        let that = this;
        console.log(e);
        let name = e.currentTarget.dataset.deviceserviceid;
        console.log(e.currentTarget.dataset.deviceserviceid);
        // console.log(e.currentTarget.dataset.deviceid);

        that.setData({
            searchFlag: false,
        });

        for (let i = 0; i < that.data.bleProp.length; i++) {
            if(that.data.bleProp[i].uuid === name){
                that.setData({
                    selectProp: JSON.stringify(that.data.bleProp[i].properties)
                })
            }
        }

        this.setData({
            grade_name2: name,
            btName: name,
            select2: false,
            // findOk: false,
            selectFlag: true,
            discovering: false,
            selectCharID: e.currentTarget.dataset.deviceserviceid
        })
    },

    // 搜索蓝牙
    searchEvent() {
        let that = this;
        if (!this.data.searchFlag)
        {
          that.setData({
              searchFlag:true,
          });


          if (that.data.discovering) {
              toast('正在搜索...');
              return;
          }
          that.setData({
              deviceList: [],
          });

          // 停止搜寻附近的蓝牙外围设备
          that.stopDiscovery();

          // 获取本机蓝牙适配器状态
          if (that.getBluetoothState()) {
              return;
          }

          // 监听蓝牙适配器状态变化事件
          // that.onBluetoothStateChange();

          // 开始搜寻附近的蓝牙外围设备
          that.startDiscovery();

          // 监听寻找到新设备
          that.onFoundBluetooth();
        }
        else
        {
          that.setData({
            searchFlag: false,
          });
          that.stopDiscovery();


        }

    },

    // 连接设备
    connectEvent() {
        let that = this;

        if (this.data.connected) {
            that.setData({
                searchFlag: false,
                deviceServiceID: [],
                selectServiceID: '',
                deviceCharID: [],
                selectCharID: '',
                bleProp: [],
                selectProp: '',
                asciiData: '',
            });
            this.disConnectReader();
            return;
        }

        if (!this.data.selectFlag) {
            toast('选择蓝牙设备');
            return;
        }

        let deviceId = this.data.bluetoothReaderID; //e.currentTarget.dataset.deviceid;

        console.log("connectEvent deviceId = " + this.data.bluetoothReaderID);

        // 停止搜寻附近的蓝牙外围设备
        this.stopDiscovery();

        // 断开与低功耗蓝牙设备的连接 然后再连接新的设备
        // this.closeConnection(deviceId);

        // 连接低功耗蓝牙设备
        this.BLEConnection(deviceId);
    },

    // 初始化蓝牙模块
    openBluetooth() {
        let that = this;
        wx.openBluetoothAdapter({
            success(e) {
                if (e.errMsg == 'openBluetoothAdapter:ok') {
                    that.setData({
                        openBluetoothAdapter: true,
                        deviceList: [],
                        available: false,
                        discovering: false,
                    });
                    that.getBluetoothState();
                }
            },
            fail() {
                wx.showModal({
                    title: '温馨提示',
                    content: '请检查手机蓝牙是否开启',
                    showCancel: false
                });
                that.setData({
                    openBluetoothAdapter: false,
                });
            },

        })
    },

    // 获取本机蓝牙适配器状态
    getBluetoothState() {
        let that = this;
        wx.getBluetoothAdapterState({
            success(e) {
                that.setData({
                    available: e.available,
                    discovering: e.discovering,
                });
                return true;
            },
            fail() {
                that.setData({
                    available: false,
                    discovering: false,
                });
                return false;
            }
        });
    },

    // 监听蓝牙适配器状态变化事件
    onBluetoothStateChange() {
        let that = this;
        wx.onBluetoothAdapterStateChange(function (res) {
            console.log('监听蓝牙适配器状态变化');
            that.setData({
                available: res.available,
                discovering: res.discovering,
            });
        });
    },

    // 开始搜寻附近的蓝牙外围设备
    startDiscovery() {
        console.log('开始搜索设备');
        let that = this;
        wx.startBluetoothDevicesDiscovery({
            success(res) {

                that.setData({
                    discovering: res.isDiscovering,
                });
            },

            fail() {
                that.setData({
                    discovering: false,
                });
                toast('搜索失败,检查蓝牙是否打开');
            }
        })
    },

    // 监听寻找到新设备的事件
    onFoundBluetooth() {
        let that = this;
        wx.onBluetoothDeviceFound(function (res) {
            for (let i = 0; i < res.devices.length; i++) {
                //if (acsUtil.isContains(res.devices[i].name,that.data.readerName)) {
                  if(!res.devices[i].localName && !res.devices[i].name){
                          continue;
                  }
                  let str = res.devices[i].localName? res.devices[i].name : res.devices[i].localName;
                  if(!str){
                      continue;
                  }
              if (acsUtil.isContains(str, that.data.readerName)) {
                console.log("@@@@@@@Find = " + res.devices[i].localName);
                    // 已经找到读卡器，为节省电量停止搜寻附近的蓝牙外围设备
                //    that.stopDiscovery();
                    that.setData({
                        // findOk: true,
                        discovering: true
                    });
                }
            }
            // 兼容安卓及iOS设备
            if (res.deviceId) {
                that.devicesData(res);
            } else if (res.devices) {
                that.devicesData(res.devices[0]);
            } else if (res[0]) {
                that.devicesData(res[0]);
            }
        });
    },

    devicesData(new_devices) {
        let that = this;
        let deviceList = that.data.deviceList;
        let len = deviceList.length;
        let isExist = false;
        console.log(new_devices);
        if (!new_devices) {
            new_devices.name = '空';
            return;
        }
        let advertisData = ab2hex(new_devices.advertisData);
        if (!advertisData) {
            advertisData = '空';
        }
        new_devices.advertisData = advertisData;
        for (let i = 0; i < len; i++) {
            if (new_devices.deviceId === deviceList[i].deviceId) {
                console.log("BT name = " + deviceList[i].name);
                isExist = true;
                deviceList.splice(i, 1, new_devices);
            }
        }

        if (!isExist) {
            deviceList.push(new_devices);
        }
        that.setData({
            deviceList: deviceList
        });
    },

    // 获取在蓝牙模块生效期间所有已发现的蓝牙设备，包括已经和本机处于连接状态的设备
    getDevices() {
        let that = this;
        wx.getBluetoothDevices({
            success: function (res) {
                console.log('获取在蓝牙模块生效期间所有已发现的蓝牙设备，包括已经和本机处于连接状态的设备');
                console.log(res);
                that.setData({
                    deviceList: res.devices
                });
            }
        })
    },

    // 停止搜寻附近的蓝牙外围设备
    stopDiscovery() {
        let that = this;
        wx.stopBluetoothDevicesDiscovery({
            success(res) {
                console.log('停止搜寻附近的蓝牙外围设备');
                // console.log(res);
                that.setData({
                    discovering: false
                });
            },
            fail() {
                toast('停止搜索失败');
            },
        });
    },

    // 连接低功耗蓝牙设备
    BLEConnection(deviceId) {
        let that = this;
        loading('连接中');
        console.log('连接中...' + deviceId);
        wx.createBLEConnection({
            deviceId: deviceId,
            timeout: 60000,
            success(res) {
                console.log('连接成功');
                that.getServices(deviceId);
                hide_Loading();
                wx.showToast({
                    title: '连接成功',
                    icon: 'succes',
                    duration: 1000,
                    mask:true
                });
                that.setData({
                    connected: true,
                    // findOk: true,
                    connectingDeviceId: deviceId,
                    AuthenticationFlag: false,
                    discovering: false,
                });
            },
            fail(res) {
                console.log('连接失败');
                console.log(res);
                that.setData({
                    connected: false,
                    // findOk: true,
                    AuthenticationFlag: false,
                    discovering: false
                });
                hide_Loading();
            },
        });
    },

    // 根据 uuid 获取处于已连接状态的设备
    getConnectedDevices(services) {
        // console.log(services)
        wx.getConnectedBluetoothDevices({
            services: services,
            success(res) {
                // console.log('根据 uuid 获取处于已连接状态的设备,成功...');
                console.log(res.errCode);
            },
            fail(res) {
                //console.log('根据 uuid 获取处于已连接状态的设备,失败...');
                console.log(res.errCode);
            },

        })
    },

    disConnectReader(){
        let that = this;
        wx.showModal({
            title: '蓝牙断开提示',
            showCancel: true,
            content: '确定断开蓝牙连接？',
            confirmText: '确定',
            cancelText: '取消',
            success: function (res) {
                if (res.cancel) {
                    // console.log(res);
                }
                else
                {
                    authed = false;
                    that.closeConnection();
                    that.setData({
                        APDU_Response:'',
                        deviceServiceID: [],
                        selectServiceID: '',
                        deviceCharID: [],
                        selectCharID: '',
                        bleProp: [],
                        selectProp: '',
                        asciiData: '',
                        connectingDeviceId: ''
                    });
                }
            },
            fail: function (res) { },//接口调用失败的回调函数
            complete: function (res) { },//接口调用结束的回调函数（调用成功、失败都会执行）
        });
    },

    // 断开与低功耗蓝牙设备的连接
    closeConnection() {
        let that = this;
        let connectingDeviceId = this.data.connectingDeviceId;
        if (!connectingDeviceId) {
            return;
        }
        that.setData({
          CardUID: '',
          ReadUIDFlag: false,
          CardPowerOn: false,
        });

        authed = false;
        that.cleanDispay();
        wx.closeBLEConnection({
            deviceId: connectingDeviceId,
            success(res) {
                console.log('断开与低功耗蓝牙设备的连接');
                console.log(res);
                that.setData({
                    connected: false,
                    AuthenticationFlag: false,
                    CardStatus:false
                });
            },
            fail() {
                // toast('断开连接失败');
                that.setData({
                    connected: true,
                    AuthenticationFlag: true
                });
            }
        });
    },

    // 获取蓝牙设备所有服务(service) 为了获取service的UUID
    getServices(deviceId) {
        let that = this;
        let serviceId = [];
        console.log("getServices" + deviceId);
        wx.getBLEDeviceServices({
            deviceId: deviceId,
            success(res) {
                console.log('获取蓝牙设备service');
                console.log(res);
                that.setData({
                    connected: true,
                    AuthenticationFlag: false,
                });
                let serviceCounter = res.services.length;
                for (let i = 0; i < serviceCounter; i++) {
                    console.log('service uuid = ' + res.services[i].uuid);
                    serviceId.push(res.services[i].uuid);
                 //   that.getCharacteristics(deviceId, res.services[i].uuid);
                }
                that.setData({
                    deviceServiceID:serviceId
                })
            },
            fail(res) {
                that.setData({
                    connected: false,
                    AuthenticationFlag: false
                });
                toast('获取服务失败');
                console.log(res);
            },
        });
    },

    // 获取蓝牙设备某个服务中所有特征值(characteristic) 为了该特征值UUID支持的操作类型
    getCharacteristics(deviceId, servicesId) {
        let that = this;
        wx.getBLEDeviceCharacteristics({
            deviceId: deviceId,
            serviceId: servicesId,
            success(res) {
                console.log('获取蓝牙设备characteristic');
                console.log(res);
                if (res.errCode === 0) {
                    let characteristics = res.characteristics;
                    let len = characteristics.length;
                    let characteristicsId = [];
                    let charProp = [];
                    for (let i = 0; i < len; i++) {
                        // if (acsUtil.isContains(servicesId,'FFF0')) {
                        //     that.setData({
                        //         btServerUUIDFFF0: servicesId,
                        //         btCharacteristicsFFF0: characteristics
                        //     })
                        // } else if (acsUtil.isContains(servicesId,'180F')) {
                        //
                        //     that.setData({
                        //         btServerUUID180F: servicesId,
                        //         btCharacteristics180F: characteristics
                        //     })
                        //
                        // } else if (acsUtil.isContains(servicesId,'180A')) {
                        //     that.setData({
                        //         btServerUUID180A: servicesId,
                        //         btCharacteristics180A: characteristics
                        //     })
                        // }
                        characteristicsId.push(characteristics[i].uuid);
                        charProp.push(characteristics[i]);
                    }
                    that.setData({
                        deviceCharID: characteristicsId,
                        bleProp: charProp
                    });
                }
            },
            fail(res) {
                toast('获取特征值失败', res);
                that.setData({
                    connected: false,
                });
            },
            // complete(res) {
            //     that.getWriteCharacteristics(that.data.btCharacteristicsFFF0);
            // }
        });
    },

    //获取通信通道特征值
    getWriteCharacteristics(characteristics) {
        let that = this;
        for (let x = 0; x < characteristics.length; x++) {
            let notify = characteristics[x].properties.notify;
            let read = characteristics[x].properties.read;
            let write = characteristics[x].properties.write;
            if (write) {
                this.setData({
                    btWriteCharacteristics: characteristics[x].uuid
                })
                //  console.log('Write characteristicsUUID = ' + characteristics[x].uuid);
                // that.initNotifyListener();
            }
            if (read && notify) {
                this.setData({
                    btRdNyCharacteristics: characteristics[x].uuid
                })
                // console.log('Read + notify characteristicsUUID = ' + characteristics[x].uuid);
            }
            if (!read && notify) {
                this.setData({
                    btNotifyCharacteristics: characteristics[x].uuid
                })
                // that.initNotifyListener();
                //  console.log('notify characteristicsUUID = ' + characteristics[x].uuid);
            }
        }
    },

    // //获取读卡器信息
    // getReaderInfo() {
    //     let that = this;
    //     //设备信息服务
    //     for (let i = 0; i < that.data.btCharacteristics180A.length; i++) {
    //         that.readBtReaderInfo(that.data.btCharacteristics180A[i].uuid);
    //     }
    // },

    // //读取电池电量
    // getReaderBatteryLevel() {
    //     let that = this;
    //     for (let i = 0; i < that.data.btCharacteristics180F.length; i++) {
    //         that.notifyValueChange(that.data.btServerUUID180F, that.data.btCharacteristics180F[i].uuid);
    //     }
    // },

    // btReaderAuthentication() {
    //     let that = this;
    //     if(authed){
    //         toast('已经认证成功，不需要重复认证');
    //         return;
    //     }
    //     let strBtCommand = that.getBtCommand('6B', "E000004500");
    //     let strResponse = '';
    //     respFlag = false;
    //     that.initNotifyListener();
    //     console.log("BT Command=>" + strBtCommand.toUpperCase());
    //     that.sendCommand({
    //         sendCommend: strBtCommand,
    //         onSuccessCallBack: function onSuccessCallBack(result) {
    //             strResponse += result;
    //             console.log('Response<=' + strResponse.toUpperCase());
    //             let msgLength = acsUtil.HexStringToInt(strResponse.substr(2,4));
    //             if(strResponse.length/2 === msgLength+5)
    //             {
    //                 console.log('Return Message Length = ' + msgLength.toString());
    //                 console.log('Response<=' + strResponse.toUpperCase());
    //                 that.processReturnMsg('6B',strResponse);
    //             }
    //         }
    //     });
    //     // console.log('Response <=' + strResponse.toUpperCase());
    // },

    // cardPowerOnOrOff(e){
    //     let that = this;
    //     let status = e;
    //     // let status = e.currentTarget.dataset.status;
    //     let strResponse = '';
    //     let strBtCommand = that.getBtCommand(status, '');
    //     that.initNotifyListener();
    //     that.sendCommand({
    //         sendCommend: strBtCommand,
    //         onSuccessCallBack: function onSuccessCallBack(result) {
    //             strResponse += result;
    //             console.log('Response<=' + strResponse.toUpperCase());
    //             let msgLength = acsUtil.HexStringToInt(strResponse.substr(2,4));
    //             if(strResponse.length/2 === msgLength+5)
    //             {
    //                 console.log('Return Message Length = ' + msgLength.toString());
    //                 console.log('Response<=' + strResponse.toUpperCase());
    //                 that.processReturnMsg(status,strResponse);
    //                 strResponse = '';
    //             }
    //         }
    //     });
    // },

    // manual_cardPowerOnOrOff(e) {
    //   let that = this;
    //   //let status = e;
    //   let status = e.currentTarget.dataset.status;
    //   let strResponse = '';
    //   let strBtCommand = that.getBtCommand(status, '');
    //   that.initNotifyListener();
    //   that.sendCommand({
    //     sendCommend: strBtCommand,
    //     onSuccessCallBack: function onSuccessCallBack(result) {
    //       strResponse += result;
    //       console.log('Response<=' + strResponse.toUpperCase());
    //       let msgLength = acsUtil.HexStringToInt(strResponse.substr(2, 4));
    //       if (strResponse.length / 2 === msgLength + 5) {
    //         console.log('Return Message Length = ' + msgLength.toString());
    //         console.log('Response<=' + strResponse.toUpperCase());
    //         that.processReturnMsg(status, strResponse);
    //         strResponse = '';
    //       }
    //     }
    //   });
    // },

    //Peripherals Control
    // These are the reader’s peripherals control commands. For Bluetooth Mode:
    peripheralsControl(e){
        let that = this;
        let P2 = e.currentTarget.dataset.status;
        let strResponse = '';
        let strBtCommand = that.getBtCommand('6B', 'E00000'+P2+'00');
        respFlag = false;
        that.initNotifyListener();
        that.sendCommand({
            sendCommend: strBtCommand,
            onSuccessCallBack: function onSuccessCallBack(result) {
                strResponse += result;
                console.log('Response<=' + strResponse.toUpperCase());
                let msgLength = acsUtil.HexStringToInt(strResponse.substr(2,4));
                if(strResponse.length/2 === msgLength+5)
                {
                    console.log('Return Message Length = ' + msgLength.toString());
                    console.log('Response<=' + strResponse.toUpperCase());
                    that.processReturnMsg(P2,strResponse);
                    strResponse = '';
                }
            }
        });
    },

    radioChange(e){
        let that = this;
        cmdType = e.detail.value;
        if(cmdType === '6F'){
            that.setData({
                placeholder:'0084000008'
            });
        }else if(cmdType === '6B'){
            that.setData({
                placeholder:'E000001800'
            });
        }
    },

    getReaderInfo() {
        let that = this;
        wx.readBLECharacteristicValue({
            deviceId: that.data.connectingDeviceId,
            serviceId: that.data.selectServiceID,
            characteristicId: that.data.selectCharID,
            success(res) {
                console.log('读取低功耗蓝牙设备的特征值的二进制数据值: 成功---');
                //  console.log(res);
            },
            fail(res) {
                console.log('读取低功耗蓝牙设备的特征值的二进制数据值: 失败---');
                //  console.log(res);
            }
        });
        // 必须在这里的回调才能获取
        that.onValueChange();
    },

    // 监听低功耗蓝牙设备的特征值变化
    onValueChange() {
        let that = this;
        let tempStr = '';
        wx.onBLECharacteristicValueChange(function (res) {
            console.log('监听低功耗蓝牙设备的特征值变化');
            console.log(res);
            tempStr = ab2hex(res.value);
            that.setData({
                asciiData: acsUtil.hexToAsciiString(tempStr),
                APDU_Response: tempStr.toUpperCase()
            })
        });
    },

    //send APDU or Escape
    bindFormSubmit(e){
        let that = this;
        let strAPDU = e.detail.value.textarea;
        console.log("command " + strAPDU);
        that.setData({
            APDU_Response :''
        });

        that.setData({
            APDU_Response :e.detail.value.textarea
        });

        if (strAPDU.length%2 !== 0 || strAPDU ==='')
        {
            toast('Command长度错误');
            return;
        }
        respFlag = true;
        let strBtCommand = that.getBtCommand(cmdType, '' + strAPDU);
        let strResponse = '';
        console.log("BT Command=>" + strBtCommand.toUpperCase());
        that.initNotifyListener();
        that.sendCommand({
            sendCommend: strBtCommand,
            onSuccessCallBack: function onSuccessCallBack(result) {
                strResponse += result;
                console.log('Response<=' + strResponse.toUpperCase());
                let msgLength = acsUtil.HexStringToInt(strResponse.substr(2,4));
                if(strResponse.length/2 === msgLength+5)
                {
                    console.log('Return Message Length = ' + msgLength.toString());
                    console.log('Response<=' + strResponse.toUpperCase());
                    that.processReturnMsg('6F',strResponse);
                    strResponse = '';
                }
            }
        });
    },


    ReadUIDProess() {
      let that = this;
      let strAPDU = 'FFCA000000';
      console.log("ReadUID " + strAPDU);
      that.setData({
        CardUID: '',
        ReadUIDFlag: true,
      });
      cmdType = '6F';
      respFlag = true;
      let strBtCommand = that.getBtCommand(cmdType, '' + strAPDU);
      let strResponse = '';
      console.log("BT Command=>" + strBtCommand.toUpperCase());
      that.initNotifyListener();
      that.sendCommand({
        sendCommend: strBtCommand,
        onSuccessCallBack: function onSuccessCallBack(result) {
          strResponse += result;
          console.log('Response<=' + strResponse.toUpperCase());
          let msgLength = acsUtil.HexStringToInt(strResponse.substr(2, 4));
          if (strResponse.length / 2 === msgLength + 5) {
            console.log('Return Message Length = ' + msgLength.toString());
            console.log('Response<=' + strResponse.toUpperCase());
            that.processReturnMsg('6F', strResponse);
            strResponse = '';
          }
        }
      });
    },



    getSlotStatus(){
        let that = this;
        let strBtCommand = that.getBtCommand('65', '');
        let strResponse = '';
        console.log("BT Command=>" + strBtCommand.toUpperCase());
        respFlag = false;
        that.initNotifyListener();
        that.sendCommand({
            sendCommend: strBtCommand,
            onSuccessCallBack: function onSuccessCallBack(result) {
                strResponse += result;
                console.log('Response<=' + strResponse.toUpperCase());
                let msgLength = acsUtil.HexStringToInt(strResponse.substr(2,4));
                if(strResponse.length/2 === msgLength+5)
                {
                    console.log('Return Message Length = ' + msgLength.toString());
                    console.log('Response<=' + strResponse.toUpperCase());
                    that.processReturnMsg('65',strResponse);
                    strResponse = '';
                }
            }
        });
    },

    processReturnMsg(cmdHead,response) {
        let that = this;
        console.log("processReturnMsg:" + response);
        let msgArray = acsUtil.strToHex(response);
        let msgLength = msgArray.length;
        let strDataBlock = response.substr(6,msgLength*2-10);
        let temp = strDataBlock.substr(0,2);
        //指令解密
        if (temp !== '83'){
            strDataBlock = CryptoJS.Decrypt(strDataBlock,sessionKey);
            console.log("---------DeReturnMsg----------:" + strDataBlock);
        }
        let dataBlockArray  = acsUtil.strToHex(strDataBlock);
        let dataBlockLength = dataBlockArray.length;
        //检查报文头
        if(msgArray[0] !== 0x05){
            console.log("Start byte error!" );
            return;
        }
        //检查报文尾
        if(msgArray[msgLength-1] !== 0x0A){
            console.log("Stop byte error!" );
            return;
        }
        //检查报文长度
        if(dataBlockLength !== msgLength-5){
            console.log("Message Length error!" );
            return;
        }
        //处理报文
        switch(dataBlockArray[0])
        {
            case 0x83: // Response to Escape Command
                if(respFlag){
                    let rspLength = acsUtil.HexStringToInt(strDataBlock.substr(2,4));
                    let strResp = strDataBlock.substr(14,rspLength*2).toUpperCase();
                    that.setData({
                        APDU_Response :strResp
                    });
                } else
                if(dataBlockArray[7] === 0xE1){
                    if(dataBlockArray[10] === 0x45){
                        that.AuthenticationNext(strDataBlock);
                    }
                    else if(dataBlockArray[10] === 0x46)
                    {
                        that.AuthenticationComplete(strDataBlock);

                    }else if(dataBlockArray[10] === 0x40){
                        if (dataBlockArray[11] === 0x01) {
                            console.log(" 打开Polling成功!");
                        }
                        else
                        {
                            that.setData({
                                CardStatus : false,
                            });
                            console.log(" 打开Polling失败!" );
                        }
                    }else if(cmdHead === '18'){ //Get Firmware Version
                        let length = acsUtil.HexStringToInt(strDataBlock.substr(22,2));
                        let strReturn = strDataBlock.substr(24,length*2).toUpperCase();
                        strReturn = acsUtil.hexToAsciiString(strReturn);
                        that.setData({
                            'readerInfo.fwVersion' : strReturn,
                        });
                    }else if(cmdHead === '47'){ //Get Serial Number
                        let length = acsUtil.HexStringToInt(strDataBlock.substr(22,2));
                        let strReturn = strDataBlock.substr(24,length*2).toUpperCase();
                        strReturn = acsUtil.hexToAsciiString(strReturn);
                        that.setData({
                            'readerInfo.serialNumber' : strReturn,
                        });
                    }else {
                        toast('BT Response Error');
                    }
                }
                break;

            case 0x50:  //Notify Card Status
                if (dataBlockArray[5] === 0x03) {
                     that.setData({
                         CardStatus : true
                     });
                    //that.cardPowerOnOrOff('62')   //cancel by alex 1.1
                }
                else if (dataBlockArray[5] === 0x02) {
                    that.setData({
                        CardStatus : false,
                    })
                }
                break;
            case 0x51:  //Response to Hardware Error
               let error = ErrorInfo.getErrorInfo(dataBlockArray[5]);
               toast(error);
                break;
            case 0x81:  //Response to Slot Status
                let status = dataBlockArray[5] & 0x43;
                if (status === 0){  //Card present (Active)
                    that.setData({
                        CardStatus : true,
                    });
                    //that.cardPowerOnOrOff('62')  //cancel by alex 1.1
                } else if (status === 1){ //Card present (Inactive)
                    that.setData({
                        CardStatus : true,
                        CardPowerOn: false,
                        CardATR: "",
                        CardUID: "",
                        ReadUIDFlag: false,
                    });
                    //that.cardPowerOnOrOff('62')   //cancel by alex 1.1
                }else if (status === 2){  //Card not present
                    that.setData({
                        CardStatus : false,
                        CardPowerOn: false,
                        CardATR: "",
                        CardUID: "",
                        ReadUIDFlag: false,
                    });
                }else if (status === 41){ //Error encountered while card is present (Inactive)
                    that.setData({
                        CardStatus : false,
                    });
                }else if (status === 40){ //Error encountered while  Card present (Active)
                    that.setData({
                        CardStatus : false,
                    });
                }
                break;
            case 0x80:  //Response to Data Block
                 let atrLength = acsUtil.HexStringToInt(strDataBlock.substr(2,4));
                 let strReturn = strDataBlock.substr(14,atrLength*2).toUpperCase();
                 console.log("Message Return = " + strReturn);
                 if(cmdHead === '62')
                 {
                   if (strReturn != "")  // by alex 1.1
                    {

                        strATR = strReturn;
                        that.setData({
                        CardATR: strReturn,
                        CardStatus: true,
                        CardPowerOn: true,
                        });

                    }
                   else                  // by alex 1.1
                    {
                     that.setData({
                         CardPowerOn: false,
                     });

                    }


                 }

                 else if ((cmdHead === '6F') && (this.data.ReadUIDFlag)) {   //1.1
                   strReturn = strReturn.substr(0, strReturn.length - 4);
                   that.setData({

                     CardUID: strReturn,
                     ReadUIDFlag: false,
                   });
                 }

                 else if(cmdHead === '6F')
                 {
                     that.setData({
                         CardStatus : true,
                         APDU_Response :strReturn,
                     });
                 }

                break;
            default:
        }
    },

    // Polling(e){
    //     let that = this;
    //     let status = e.currentTarget.dataset.status;
    //     let strResponse = '';
    //     let strBtCommand = that.getBtCommand('6B', "E0000040" + status);
    //     respFlag = false;
    //     that.initNotifyListener();
    //     that.sendCommand({
    //         sendCommend: strBtCommand,
    //         onSuccessCallBack: function onSuccessCallBack(result) {
    //             strResponse += result;
    //             console.log('Response<=' + strResponse.toUpperCase());
    //             let msgLength = acsUtil.HexStringToInt(strResponse.substr(2,4));
    //             if(strResponse.length/2 === msgLength+5)
    //             {
    //                 console.log('Return Message Length = ' + msgLength.toString());
    //                 console.log('Response<=' + strResponse.toUpperCase());
    //                 that.processReturnMsg('6B',strResponse);
    //                 strResponse = '';
    //             }
    //         }
    //     });
    // },

    // AuthenticationComplete(strDataBlock){
    //     let that = this;
    //     let randX = strDataBlock.substr(24,32);
    //     //比较随机数
    //     let temp = CryptoJS.Decrypt(randX ,"41435231323535552D4A312041757468").toUpperCase();
    //     console.log("Decrypt RandB:" + temp);
    //     if(randB === temp){
    //         console.log("Authentication Success");
    //         sessionKey += temp.substr(0,16);
    //         console.log("SessionKey:" + sessionKey);
    //         authed = true;
    //         that.setData({
    //             AuthenticationFlag : true
    //         })
    //     }
    //     else
    //     {
    //         authed = false;
    //         console.log("Authentication Failed");
    //         that.setData({
    //             AuthenticationFlag : false
    //         })
    //     }
    //
    // },

    // AuthenticationNext(strMessage){
    //     let that = this;
    //     let randA = strMessage.substr(24,32);
    //     let temp = CryptoJS.Decrypt(randA,'41435231323535552D4A312041757468');
    //     console.log("Decrypt RandA:" + temp);
    //     sessionKey = temp.substr(0,16);
    //     randB = acsUtil.getRamNumber(32);
    //     console.log("randB:" + randB);
    //     let strData = CryptoJS.Decrypt(randB + temp,'41435231323535552D4A312041757468');
    //     let strBtCommand = that.getBtCommand('6B', "E000004600" + strData);
    //     let strResponse = '';
    //     respFlag = false;
    //     // that.initNotifyListener();
    //     console.log("BT Command=>" + strBtCommand.toUpperCase())
    //     that.sendCommand({
    //         sendCommend: strBtCommand,
    //         onSuccessCallBack: function onSuccessCallBack(result) {
    //             strResponse += result;
    //             console.log('Response<=' + strResponse.toUpperCase());
    //             let msgLength = acsUtil.HexStringToInt(strResponse.substr(2,4));
    //             if(strResponse.length/2 === msgLength+5)
    //             {
    //                 console.log('Return Message Length = ' + msgLength.toString());
    //                 console.log('Response<=' + strResponse.toUpperCase());
    //                 that.processReturnMsg('6B', strResponse);
    //             }
    //         }
    //     });
    //     // console.log('Response <=' + strResponse.toUpperCase());
    // },

    //组装蓝牙指令
    getBtCommand(commandType, strCommand) {
        let that = this;
        let bMessageType = commandType;
        let msgLength = '0000';
        let slotNumber = '00';
        let sequence = '00';
        let parameter = '00';
        let checkSum = '00';
        let sendCommand = '';
        let commandLength = 0 ;

        let temp = strCommand.substr(6,2).toUpperCase();

        let strData = strCommand;
        let dataLength = strData.length / 2;
        msgLength = acsUtil.padLeft(dataLength.toString(16), 4, '0');

        let strBtCommand = bMessageType + msgLength + slotNumber + sequence + parameter + checkSum + strData;
        checkSum = that.calcCheckSum(strBtCommand, 0, strBtCommand.length / 2);
        strBtCommand = bMessageType + msgLength + slotNumber + sequence + parameter + checkSum + strData;
        //认证指令不需要加密
        if(temp !== '45' && temp !== '46'){
            let paddingLength = 0;
            if (strBtCommand.length % 32 !== 0){
                paddingLength = 32 - strBtCommand.length % 32;
            }
            strBtCommand = acsUtil.padRight(strBtCommand,strBtCommand.length + paddingLength,'F');
            console.log('========strBtCommand======== :' + strBtCommand);
            strBtCommand = CryptoJS.Encrypt(strBtCommand,sessionKey);
            console.log('++++++++EnBtCommand+++++++++ :' + strBtCommand);
        }
        commandLength = strBtCommand.length / 2;
        sendCommand = '05' + acsUtil.padLeft(commandLength.toString(16), 4, '0') + strBtCommand;
        checkSum = that.calcCheckSum(sendCommand, 2, sendCommand.length - 2);
        sendCommand = sendCommand + checkSum + '0A';
        return sendCommand;
    },

    //计算CheckSum
    calcCheckSum(strData, offset, length) {
        let data = [];
        let checksum = 0x00;

        data = acsUtil.strToHex(strData);
        length = data.length;

        if (strData != null) {
            for (let index = offset; index < (offset + length); index++) {
                checksum ^= data[index];
            }
        }
        return acsUtil.padLeft(checksum.toString(16), 2, '0');
    },

    //启用低功耗蓝牙设备特征值变化时的 notify 功能，订阅特征值
    notifyValueChange(services_UUID, characteristic_UUID) {
        let that = this;
        wx.notifyBLECharacteristicValueChange({
            deviceId: that.data.connectingDeviceId,
            serviceId: services_UUID,
            characteristicId: characteristic_UUID,
            state: true,
            success(res) {
                console.log('启用notify功能:成功');

                wx.readBLECharacteristicValue({
                    deviceId: that.data.connectingDeviceId,
                    serviceId: services_UUID,
                    characteristicId: characteristic_UUID,
                    success(res) {
                        console.log('读蓝牙设备二进制数据值: 成功');
                    },
                    fail(res) {
                        console.log('读蓝牙设备二进制数据值: 失败' + res.errCode);
                    }
                });

                wx.onBLECharacteristicValueChange(function (res) {
                    console.log('监听低功耗蓝牙设备的特征值变化' + res);
                    let temp = parseInt(ab2hex(res.value), 16).toString() + '%';
                    console.log(" return = " + temp);
                    that.setData({
                        APDU_Response :temp
                    });
                });
            },
            fail(res) {
                console.log('启用notify功能，失败---' + res.errCode);
            },
        });
    },

    // //获取蓝牙读卡器信息
    // readBtReaderInfo(btCharacteristics) {
    //     let that = this;
    //     let btServiceID = that.data.btServerUUID180A;
    //     let btReaderID = this.data.connectingDeviceId;
    //     console.log("特征值:" + btCharacteristics);
    //
    //     wx.readBLECharacteristicValue({
    //         deviceId: btReaderID,
    //         serviceId: btServiceID,
    //         characteristicId: btCharacteristics,
    //         success(res) {
    //             console.log('读取低功耗蓝牙设备的特征值的二进制数据值: 成功---');
    //             //  console.log(res);
    //         },
    //         fail(res) {
    //             console.log('读取低功耗蓝牙设备的特征值的二进制数据值: 失败---');
    //             //  console.log(res);
    //         }
    //     });
    //     // 必须在这里的回调才能获取
    //     that.onValueChange();
    // },

    // // 监听低功耗蓝牙设备的特征值变化
    // onValueChange() {
    //     let that = this;
    //     let tempStr = '';
    //     wx.onBLECharacteristicValueChange(function (res) {
    //         console.log('监听低功耗蓝牙设备的特征值变化');
    //         console.log(res);
    //         if (res.characteristicId.indexOf("2A23") !== -1) {
    //             tempStr = ab2hex(res.value);
    //             that.setData({
    //                 'readerInfo.systemID': tempStr.toUpperCase()
    //             })
    //         }
    //
    //         if (res.characteristicId.indexOf("2A24") !== -1) {
    //             let tempStr = acsUtil.hexToAsciiString(ab2hex(res.value));
    //             that.setData({
    //                 'readerInfo.modelNumber': tempStr.toUpperCase()
    //             })
    //         }
    //
    //         if (res.characteristicId.indexOf("2A25") !== -1) {
    //             tempStr = acsUtil.hexToAsciiString(ab2hex(res.value));
    //             that.setData({
    //                 'readerInfo.serialNumber': tempStr.toUpperCase()
    //             })
    //         }
    //
    //         if (res.characteristicId.indexOf("2A26") !== -1) {
    //             tempStr = acsUtil.hexToAsciiString(ab2hex(res.value));
    //             that.setData({
    //                 'readerInfo.fwVersion': tempStr.toUpperCase()
    //             })
    //         }
    //
    //         if (res.characteristicId.indexOf("2A29") !== -1) {
    //             tempStr = acsUtil.hexToAsciiString(ab2hex(res.value));
    //             that.setData({
    //                 'readerInfo.manufacturerName': tempStr.toUpperCase()
    //             })
    //         }
    //     });
    // },

    ///////////////////////////////////////////////////////////////////
    /**
     *
     * 连接成功后，初始化回调监听
     *
     * 启用低功耗蓝牙设备特征值变化时的 notify 功能。注意：\
     * 必须设备的特征值支持notify才可以成功调用，具体参照 characteristic 的 properties 属性
     */
    initNotifyListener() {
        let that = this;
        wx.notifyBLECharacteristicValueChanged({
            deviceId: that.data.connectingDeviceId,
            serviceId: that.data.selectServiceID,
            characteristicId: that.data.selectCharID,
            state: true,
            success: function (res) {
                console.log(`开启监听成功${res.errMsg}`);
                // setTimeout(function () {
                //     onConnectCallback('ok');// 连接成功后，初始化回调监听回调
                //     sendCmd(params.sendCommend, params.onSuccessCallBack, params.onFailCallBack);
                // }, 200);
            },
            fail: function (res) {
                console.log("开启监听失败" + res.errMsg);
                // params.onFailCallBack("开启监听失败");
            }
        });
        that.onBLECharacteristicValueChange();
    },

    /**
     * 启用低功耗蓝牙设备特征值变化时的 notify 功能。注意：
     * 必须设备的特征值支持notify才可以成功调用，具体参照 characteristic 的 properties 属性
     */
    onBLECharacteristicValueChange() {
        wx.onBLECharacteristicValueChange(function (res) {
            //    console.log(`characteristic ${res.characteristicId} has changed, now is ${acsUtil.arrayBuffer2HexString(res.value)}`);
            onSendSuccessCallBack(acsUtil.arrayBuffer2HexString(res.value));
        })
    },

    /**
     * 发送指令，不关心指令具体长度
     * @param command 指令
     * @param onSuccess 指令执行成功回调
     */
    sendCmd(command, onSuccess, onFailCallback) {
        let that = this;
        let sendCommands = command;
        if (typeof onSuccess === 'undefined') {
            onSuccess = function (result) { }
        }
        onSendSuccessCallBack = onSuccess;
        that.sendCmds(sendCommands, 0, onFailCallback);
    },

    //逐条发送指令
    sendCmds(command, index, onFailCallback) {
        let that = this;
        let itemCmd;
        let isLast = false;// 判断是否是最后一条
        if (command.length > index + 40) {
            itemCmd = command.substr(index, 40);
        } else {
            isLast = true;
            itemCmd = command.substr(index);
        }
        that.writeCommendToBle(itemCmd, function (errMsg) {
            if (errMsg === 'ok' && !isLast) { // 发送成功并且不是最后一条时，执行下一条
                that.sendCmds(command, index + 40);
            }
        }, onFailCallback)
    },

    // 向蓝牙中写入数据
    writeCommendToBle(commands, onSendCallback, onFailCallback) {
        let that = this;
        let command = commands;
        console.log("command ：" + command)
        let buffer = acsUtil.hexString2ArrayBuffer(command);
         console.log(`执行指令:${acsUtil.arrayBuffer2HexString(buffer)}`);
        wx.writeBLECharacteristicValue({
            deviceId: that.data.connectingDeviceId,
            serviceId: that.data.btServerUUIDFFF0,
            characteristicId: that.data.btWriteCharacteristics,
            // 这里的value是ArrayBuffer类型
            value: buffer,
            success: function (res) {
                console.log('发送指令成功')
                console.log('writeBLECharacteristicValue success', res.errMsg)
                onSendCallback('ok');
            },
            fail: function (res) {
                console.log(`执行指令失败${res.errMsg}`);
                onFailCallback("执行指令失败");
            }
        })
    },

    sendCommand(params) {
        let that = this;
        let defaults = {
            sendCommend: "",
            onSuccessCallBack: function successCallBack(res) { },
            onFailCallBack: function failCallBack(res) { },
            onCompleteCallBack: function completeCallBack(res) { },
        };
        let setParams = Object.assign(defaults, params);
        that.writeCommand(setParams);
    },

    writeCommand(options) {
        let that = this;
        let params = {};
        let defalt = {
            sendCommend: "",
            onSuccessCallBack: function success(res) { },
            onFailCallBack: function success(res) { },
            onCompleteCallBack: function success(res) { },
        };
        params = Object.assign(defalt, options);
        that.sendCmd(params.sendCommend, params.onSuccessCallBack, params.onFailCallBack);
    },

    // 关闭蓝牙模块
    closeBluetooth() {
        wx.closeBluetoothAdapter({
            success() {
                toast('关闭成功');
            },
            fail() {
                toast('关闭失败');
            }
        });
    },

    Mifare: function(){
      wx.navigateTo({
        url: '../Mifare/Mifare'

      })

    }





});

// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
    let hexArr = Array.prototype.map.call(
        new Uint8Array(buffer),
        function (bit) {
            return ('00' + bit.toString(16)).slice(-2);
        }
    );
    return hexArr.join('');
}

/**
 * 16进制字符串转ArrayBuffer
 */
function hex2ab(str) {
    if (!str) {
        return new ArrayBuffer(0);
    }
    let typedArray = new Uint8Array(str.match(/[\da-f]{2}/gi).map(function (h) {
        return parseInt(h, 16)
    }));
    let buffer1 = typedArray.buffer;
    console.log(buffer1);
    return buffer1;
}

// 16进制字符串取需要的字节(fe 08 01 00 01 01 01 7a0b 008f)
function hexSlice(hex) {
    // 取k8位
    let k8 = hex.slice(14, 16);
    //取k9位
    let k9 = hex.slice(16, 18);
    return parseInt(k9 + k8, 16);
}

function toast(title) {
    wx.showToast({
        title: title,
        icon: 'none',
        duration: 1500,
        success() {
            setTimeout(() => {
                wx.hideToast();
            }, 2000);

        }
    });
}

function loading(title) {
    wx.showLoading({
        title: title,
        mask: true,
    });
}

function hide_Loading() {
    wx.hideLoading();
}

function Str2Bytes(str) {
    var pos = 0;
    var len = str.length;
    if (len % 2 != 0) {
        return null;
    }
    len /= 2;
    var hexA = new Array();
    for (var i = 0; i < len; i++) {
        var s = str.substr(pos, 2);
        var v = parseInt(s, 16);
        hexA.push(v);
        pos += 2;
    }
    return hexA;
}

//字节数组转十六进制字符串
function Bytes2Str(arr) {
    var str = "";
    for (var i = 0; i < arr.length; i++) {
        var tmp = arr[i].toString(16);
        if (tmp.length == 1) {
            tmp = "0" + tmp;
        }
        str += tmp;
    }
    return str;
}

function arrayBufferToHexString(buffer) {
    let bufferType = Object.prototype.toString.call(buffer)
    if (buffer != '[object ArrayBuffer]') {
        return
    }
    let dataView = new DataView(buffer)

    var hexStr = '';
    for (var i = 0; i < dataView.byteLength; i++) {
        var str = dataView.getUint8(i);
        var hex = (str & 0xff).toString(16);
        hex = (hex.length === 1) ? '0' + hex : hex;
        hexStr += hex;
    }

    return hexStr.toUpperCase();
}

function hexStringToArrayBuffer(str) {
    if (!str) {
        return new ArrayBuffer(0);
    }
    var buffer = new ArrayBuffer(str.length);
    let dataView = new DataView(buffer)
    let ind = 0;
    for (var i = 0, len = str.length; i < len; i += 2) {
        let code = parseInt(str.substr(i, 2), 16)
        dataView.setUint8(ind, code)
        ind++
    }
    return buffer;
}
