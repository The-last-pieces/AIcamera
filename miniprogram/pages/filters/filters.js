/* global getApp, Page */
import regeneratorRuntime from "../../libs/runtime";
import {
    smoothX,
    smoothY,
    kernel,
    sharpenImage
} from "./mathtools";
import {
    EasyImage,
    ImageOps,
    dft,
    Color,
    savebase64image,
    getUrl,
    drawOnCanvas
} from "../../utils/tools";


//import { uint2base , base2uint } from "../../utils/tools";

let originImageData = null;
let resultImageData = null;

Page({
    data: {
        fileID:null,
        containerWidth: 600,
        containerHeight: 0,
        loading: "../../images/loading.jpg",
        originLoaded: false,
        pending: false,
        buttonlist: [],
        arglist:[],
        argpos:[],
        movefuns:[],
    },
    onLoad() {
        //注册所有按钮
        this.regbuttons();

        ///计算初始尺寸
        let app = getApp();
        let {
            windowWidth
        } = wx.getSystemInfoSync();
        this.setData({
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
        }, () => {
            // 加载
            this.pending(true);
            let ctx = wx.createCanvasContext('canvas');
            getUrl(this.data.fileID).then(temp => {
                wx.getImageInfo({
                    src: temp,
                    success: (res) => {
                        ctx.drawImage(
                            res.path,
                            0,
                            0,
                            this.data.rect.imageWidth,
                            this.data.rect.imageHeight,
                            0,
                            0,
                            canvasWidthPx,
                            canvasHeightPx
                        );
                        ctx.draw(true, () => {
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
                            }, this);
                        });
                    },
                })
            })
        });

        
    },

    regbuttons() {
        //公共函数
        let gaussSmooth = (k) => {
            /**
             * @returns {EasyImage}
             * @param {EasyImage} img 
             */
            return img => {
                let source = img.getUint8Clamp();
                let gKernel = kernel(k);
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
                let res = new EasyImage(width,height);
                res.loadUint8Clamp(smoothData);
                return res;
            }
        }

        //开始注册
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
            let res = new EasyImage(img.width, img.height);
            res.loadUint8Clamp(data);
            return res;
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
        this.register("边缘信息", (img, args) => {
            let ker = gaussSmooth(args[0] / 10 + 1);
            let imp = ker(img);
            for (let i = 0; i < img.width; ++i) {
                for (let j = 0; j < img.height; ++j) {
                    imp.set(i, j, img.get(i, j).add(imp.get(i, j).multiple(-1)).trim());
                }
            }
            return imp;
        }, {
            name: "信息丰度",
            density: 10
        });
        this.register("锐化", (img, args) => {
            let ker = gaussSmooth(args[0] / 10 + 1);
            let imp = ker(img);
            for (let i = 0; i < img.width; ++i) {
                for (let j = 0; j < img.height; ++j) {
                    imp.set(i, j, img.get(i, j).multiple(2).add(imp.get(i, j).multiple(-1)).trim());
                }
            }
            return imp;
        }, {
            name: "锐化程度",
            density: 10
        });
        this.register("高斯模糊", (img, args) => {
            let trans = gaussSmooth(args[0] / 10 + 1);
            return trans(img);
        }, {
            name: "模糊程度",
            density: 10
        });
        this.register("透明化",  (img, args) => {
            img.data.forEach(i => {
                i.forEach(j => {
                    j.a = Math.floor(j.a * (255 - args[0]) / 255);
                })
            });
            return img;
        },{
            name:"透明度",
            density:255,
            max:255,
            min:0
        });
        this.register("色彩丰富度",(img,args)=>{
            img.data.forEach(i => {
                i.forEach(j => {
                    ['r', 'g', 'b'].forEach((v, i) => {
                        j[v] = Math.floor(j[v] * ((args[i] + 255 * 0.5) / 255));
                    })
                })
            });
            return img;
        },[{
            name:"R",
            density:255,
            max:255,
            min:0
        },{
            name:"G",
            density:255,
            max:255,
            min:0
        },{
            name:"B",
            density:255,
            max:255,
            min:0
        }])
        this.register("高色差", (img, args) => {
            let colors = []
            let wdensity = args[0];
            let hdensity = args[1];
            for (let i = 1; i <= wdensity; ++i) {
                for (let j = 1; j <= hdensity; ++j) {
                    colors.push(img.get(i / (wdensity + 1) * img.width, j / (hdensity + 1) * img.height));
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
        }, [{
            name: "X方向取色点个数",
            min: 3,
            max: 15
        }, {
            name: "Y方向取色点个数",
            min: 3,
            max: 15
        }]);
        this.register("马赛克", (img, args) => {
            let density = args[0];
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
        }, {
            name: "马赛克尺寸",
            min: 4,
            max: 12
        });
        this.register("毛玻璃", (img, args) => {
            let mm = args[0];
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
        }, {
            name: "取样半径",
            min: 2,
            max: 8
        });
        this.register_byfname("裁剪","handleClipTap");

        //注册完毕
        this.setData({
            buttonlist: this.data.buttonlist
        });
    },

    /**
     * 
     * @param {String} buttonname 
     */
    register(buttonname, fct = dft, arglist = []) {
        if(!Array.isArray(arglist)){
            arglist = [arglist];
            //单变量可之间传入对象,自动转换为数组
        }
        //arglist用于描述图像处理需要什么参数
        //若不指定,则不渲染调参界面
        //参数格式:
            //max可选,默认100 或 (min+1)    //上界
            //min可选,默认0                 //下界
            //default可选,默认0.5           //初始位置
            //density可选,默认和range一样   //稀疏度

        let tapfun = "filters-" + Date.now() + "-time-" + this.data.buttonlist.length + "-id";
        this.data.buttonlist.push({
            tapfun,
            buttonname
        });

        //按钮点击和滑动调参绑定的函数均会调用此函数,用于图像渲染
        let that = this;
        let render = async function () {
            let {
                width,
                height
            } = originImageData;

            // 开始像素处理
            that.pending(true);

            new ImageOps(fct).deal(originImageData.data, {
                width,
                height,
                need: that.data.argpos.map(v => v)
            }).then(data => {
                // 将处理后的图片输出到画布
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
                        that.pending(false);
                    }
                }, that);
            }).catch(e => {
                that.pending(false);
                wx.showModal({
                    cancelColor: 'cancelColor',
                    content: "处理出错" + JSON.stringify(e)
                });
                console.error(e);
            })
        }

        let movefuns = [];
        arglist.forEach((v, i) => {
            //填充缺省值
            v.min || (v.min = 0);
            v.max || (v.max = Math.max(v.min + 1, 100));
            v.default || (v.default = 0.5);
            v.range = v.max - v.min;
            v.value = v.range * v.default + v.min;
            v.density || (v.density = v.range);
            v.step = v.range / v.density;

            //设置响应函数
            let movefun = "movers-" + Date.now() + "-time-" + this.data.buttonlist.length + "-id-" + i + "arg";
            movefuns.push(movefun);
            this[movefun] = async function (e) {
                this.data.argpos[i] = e.detail.value;
                this.setData({
                    argpos:this.data.argpos
                })
                render();
            }
        });

        this[tapfun] = async function () {
            //处理参数
            this.setData({
                arglist, //设置参数列表
                argpos: arglist.map(v => v.value),
                movefuns
            });
            
            render();
        }
    },

    register_byfname(buttonname, functionname) {
        this.data.buttonlist.push({
            tapfun: functionname,
            buttonname
        });
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
                wx.navigateTo({
                    url: "../../pages/clip/clip"
                });
            }
        });
    },
    pending(bool) {
        this.setData({
            pending: !!bool
        });
        return;
        if (bool) {
            wx.showLoading();
        } else {
            wx.hideLoading();
        }
    }
});
