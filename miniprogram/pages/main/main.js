/* global getApp, Page */
import {
    uploadToCloud
} from "../../utils/tools";
import regeneratorRuntime from "../../libs/runtime";

Page({
    data: {
        fileID: null,
        hasUploaded: false,
        faceRects: [],
        imgrect: {
            imageHeight: 0,
            imageWidth: 0
        },
        resMap: {
            Gender: {
                label: "性别",
                valMap: {
                    0: "女",
                    1: "男"
                }
            },
            Age: {
                label: "年龄"
            },
            Expression: {
                label: "微笑",
                valMap: {
                    0: "否",
                    1: "是"
                }
            },
            Glass: {
                label: "是否有眼镜"
            },
            Beauty: {
                label: "魅力"
            },
            Hat: {
                label: "是否有帽子"
            },
            Mask: {
                label: "是否有口罩"
            },
            Score: {
                label: "质量分"
            },
            Sharpness: {
                label: "清晰分"
            },
            Brightness: {
                label: "光照分"
            }
        }
    },
    async handleUploadTap() {
        await this.uploadImage();
    },

    async handleRecognizeTap() {
        await this.callFunction();
    },

    async handleFilterTap() {
        var app = getApp();
        app.globalData.fileID = this.data.fileID;
        app.globalData.temUrl = this.data.temUrl;
        app.globalData.rect = this.data.imgrect;

        wx.navigateTo({
            url: "../filters/filters"
        });
    },

    async uploadImage() {
        wx.chooseImage({
            sourceType: ['album', 'camera'],
            count: 1,
            success: dRes => {
                let temUrl = dRes.tempFilePaths[0];
                this.setData({
                    temUrl
                });

                wx.showLoading({
                    title: "上传中"
                });

                uploadToCloud(temUrl).then(
                    res => {
                        wx.getImageInfo({
                            src: res.fileID,
                            success: suc => {
                                this.setData({
                                        fileID: res.fileID,
                                        hasUploaded: true,
                                        imgrect: {
                                            imageHeight: suc.height,
                                            imageWidth: suc.width
                                        },
                                        //清空上次的结果
                                        faceRects: []
                                    },
                                    () => {
                                        wx.hideLoading();
                                    }
                                );
                            }
                        })
                    },
                    e => {
                        wx.hideLoading();
                        wx.showToast({
                            title: "上传失败",
                            icon: "none"
                        });
                    }
                ).catch(e => {

                    wx.hideLoading();
                });
            }
        });
    },

    async callFunction() {
        wx.showLoading({
            title: "识别中",
            icon: "none"
        });

        try {
            let {
                result
            } = await wx.cloud.callFunction({
                name: "detectfact",
                data: {
                    id: this.data.fileID
                }
            });
            wx.hideLoading();
            if (!result.code && result.data) {
                this.setData({
                        faceRects: this.getFaceRects(result.data)
                    },
                    () => {
                        this.triggerEvent("finish", result.data);
                    }
                );
            } else {
                throw result;
            }
        } catch (e) {
            wx.hideLoading();
            wx.showToast({
                title: "识别失败,图片中可能不存在人脸",
                icon: "none"
            });
        }
    },

    // 计算人脸位置
    getFaceRects(res) {
        const {
            ImageWidth,
            ImageHeight,
            FaceInfos
        } = res;
        let item = FaceInfos[0];
        return [{
            ...item,
            imageWidth: ImageWidth,
            imageHeight: ImageHeight,
            rectX: item.X / ImageWidth,
            rectY: item.Y / ImageHeight,
            rectWidth: item.Width / ImageWidth,
            rectHeight: item.Height / ImageHeight
        }];
    },

    handleFinish(e) {
        if (!e.detail) {
            return;
        }
        console.log(e.detail);
    }
});
