/* global getApp, Page */
import regeneratorRuntime from "../../libs/runtime";
import {
    smoothX,
    smoothY,
    kernel
} from "./mathtools";
import {
    EasyImage,
    ImageOps,
    dft,
    Color,
    savebase64image
} from "../../utils/tools";

//import { uint2base , base2uint } from "../../utils/tools";

let originImageData = null;
let resultImageData = null;

Page({
    data: {
        containerWidth: 600,
        containerHeight: 0,
        loading: "../../images/loading.jpg",
        originLoaded: false,
        pending: false,
        buttonlist: []
    },
    onLoad() {
        this.regbuttons();

        let app = getApp();
        let {
            windowWidth
        } = wx.getSystemInfoSync();
        this.setData({
            temUrl: app.globalData.temUrl,
            fileID: app.globalData.fileID,
            rect: app.globalData.rect
        });

        // // 画布容器高度，单位 rpx
        let containerHeight = Math.floor(
            (this.data.rect.imageHeight / this.data.rect.imageWidth) *
            this.data.containerWidth
        );

        // 画布宽高，单位 px
        let canvasWidthPx = Math.floor(
            (windowWidth / 750) * this.data.containerWidth
        );
        let canvasHeightPx = Math.floor((windowWidth / 750) * containerHeight);
        this.setData({
            canvasWidthPx,
            canvasHeightPx,
            containerHeight
        });

        // 加载
        this.pending(true);
        let ctx = wx.createCanvasContext(`canvas`, this);
        ctx.drawImage(
            this.data.temUrl,
            0,
            0,
            this.data.rect.imageWidth,
            this.data.rect.imageHeight,
            0,
            0,
            canvasWidthPx,
            canvasHeightPx
        );
        ctx.draw(false, () => {
            setTimeout(() => {
                // 获取画布上的像素信息
                wx.canvasGetImageData({
                    canvasId: "canvas",
                    x: 0,
                    y: 0,
                    width: canvasWidthPx,
                    height: canvasHeightPx,
                    success: ({
                        width,
                        height,
                        data
                    }) => {
                        originImageData = {
                            width,
                            height,
                            data
                        };
                        resultImageData = {
                            width,
                            height,
                            data
                        };
                        this.setData({
                            originLoaded: true
                        });
                    },
                    fail: e => {
                        console.log(e);
                    },
                    complete: () => {
                        this.pending(false);
                    }
                });
            }, 200);
        });

    },

    regbuttons() {
        //还原,怀旧,毛玻璃,卡通化,透明化
        this.register("还原", img => img);
        this.register("怀旧", img => {
            let data = img.getUint8Clamp();
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                data[i] = 0.393 * r + 0.769 * g + 0.189 * b;
                data[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
                data[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
            }
            img.loadUint8Clamp(data);
            return img;
        });
        this.register("高斯模糊", img => {
            let source = img.getUint8Clamp();
            let gKernel = kernel(6);
            let {
                width,
                height
            } = img;
            let smoothData = new Uint8ClampedArray(img.width * img.height * 4);

            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    let pointIndex = (x + y * width) * 4;
                    let chanels = smoothX(
                        pointIndex,
                        gKernel,
                        y * width * 4,
                        ((1 + y) * width - 1) * 4,
                        source
                    );
                    chanels.forEach((chanel, index) => {
                        smoothData[pointIndex + index] = chanel;
                    });
                }
            }
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    let pointIndex = (x + y * width) * 4;
                    let chanels = smoothY(pointIndex, gKernel, width, smoothData);
                    chanels.forEach((chanel, index) => {
                        smoothData[pointIndex + index] = chanel;
                    });
                }
            }
            img.loadUint8Clamp(smoothData);
            return img;
        });
        this.register("卡通化", async img => {
            let {
                result
            } = (await wx.cloud.callFunction({
                name: "cartonface",
                data: {
                    id: this.data.fileID
                }
            }));
            if (result.code == false) {
                throw "人脸卡通化出错"
            }
            let id = await savebase64image(result.data);

            let ops = new EasyImage();
            await ops.loadFromPath(this, id, img);
            return ops;
        });
        this.register("透明化", img => {
            img.data = img.data.map(i => {
                return i.map(j => {
                    j.a = Math.floor(j.a / 2);
                    return j;
                })
            });
            return img;
        });
        this.register("高色差", img => {
            let colors = []
            let density = 8;
            for (let i = 1; i <= density; ++i) {
                for (let j = 1; j <= density; ++j) {
                    colors.push(img.get(i / (density + 1) * img.width, j / (density + 1) * img.height));
                }
            }
            img.data = img.data.map(i => {
                return i.map(j => {
                    let min_index = -1;
                    let min_differ = Infinity;
                    colors.forEach((v, ind) => {
                        let dif = Color.differ(v, j);
                        if (dif < min_differ) {
                            min_index = ind;
                            min_differ = dif;
                        }
                    });
                    return colors[min_index];
                })
            });
            return img;
        });
        this.register("马赛克", img => {
            let density = 5;
            for (let m = 0; m < img.width; ++m) {
                for (let n = 0; n < img.height; ++n) {
                    if (m % density == 0 && n % density == 0) {
                        let {
                            r,
                            g,
                            b,
                            a
                        } = img.get(m, n);
                        for (let i = 0; i < density; ++i) {
                            for (let j = 0; j < density; ++j) {
                                try {
                                    img.set(i + m, j + n, new Color(r, g, b, a));
                                } catch (error) {

                                }
                            }
                        }
                    }
                }
            }
            return img;
        });
        this.register("毛玻璃", img => {
            let mm = 2
            let des = new EasyImage(img.width, img.height);
            for (let m = 0; m < img.width; ++m) {
                for (let n = 0; n < img.height; ++n) {
                    let w = m + Math.floor(Math.random() * mm) - mm / 2;
                    let h = n + Math.floor(Math.random() * mm) - mm / 2;
                    try {
                        let {
                            r,
                            g,
                            b,
                            a
                        } = img.get(w, h);
                        des.set(m, n, new Color(r, g, b, a));
                    } catch (e) {
                        --n;
                    }
                }
            }
            return des;
        });
        this.setData({
            buttonlist: this.data.buttonlist
        });
    },

    /**
     * 
     * @param {String} buttonname 
     */
    register(buttonname, fct = dft) {
        let funname = "filters-" + Date.now() + "-time-" + this.data.buttonlist.length + "-id";
        this.data.buttonlist.push({
            funname,
            buttonname
        });
        this[funname] = async function () {
            let {
                width,
                height
            } = originImageData;

            // 开始像素处理
            this.pending(true);

            new ImageOps(fct).deal(originImageData.data, {
                width,
                height
            }).then(data => {
                //console.log(data);
                // 将处理后的图片输出到画布
                //wx.createCanvasContext('canvas', this).draw(true, () => {
                wx.canvasPutImageData({
                    canvasId: "canvas",
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                    data: data,
                    success: data => {
                        resultImageData = {
                            width,
                            height,
                            data: data
                        };
                    },
                    fail: e => {
                        console.error(e);
                    },
                    complete: () => {
                        // 绘制完成
                        this.pending(false);
                        wx.showToast({
                            title: "完成",
                        })
                    }
                }, this);
                // })
            }).catch(e => {
                this.pending(false);
                wx.showModal({
                    cancelColor: 'cancelColor',
                    content: "处理出错" + JSON.stringify(e)
                });
                console.error(e);
            })
        }
    },

    handleClipTap() {
        let app = getApp();
        app.globalData.filterImageInfo = {
            width: resultImageData.width,
            height: resultImageData.height
        };

        let {
            pixelRatio
        } = wx.getSystemInfoSync();
        wx.canvasToTempFilePath({
            canvasId: "canvas",
            width: resultImageData.width,
            height: resultImageData.height,
            destWidth: resultImageData.width * pixelRatio,
            destHeight: resultImageData.height * pixelRatio,
            success: ({
                tempFilePath
            }) => {
                app.globalData.filterTemUrl = tempFilePath;
                console.log(tempFilePath);
                wx.navigateTo({
                    url: "/pages/clip/index"
                });
            }
        });
    },
    pending(bool) {
        1-2;;
        this.setData({
            pending: !!bool
        });
        if (bool) {
            wx.showLoading();
        } else {
            wx.hideLoading();
        }
    }
});
