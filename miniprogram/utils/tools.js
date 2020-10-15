export function uploadToCloud(fileName, folderName = "default") {
    return new Promise((resolve, reject) => {
        const dotPosition = fileName.lastIndexOf(".");
        const extension = fileName.slice(dotPosition);
        const cloudPath = folderName + `/${Date.now()}-${Math.floor(Math.random(0, 1) * 10000)}${extension}`;
        
        wx.cloud.uploadFile({
            cloudPath,
            filePath: fileName,
            success: res => {
                resolve(res);
            },
            fail: () => {
                reject();
            }
        });
    });
}


export async function getUrl(fid){
    let urls = await wx.cloud.getTempFileURL({
        fileList: [fid]
    });
    return urls.fileList[0].tempFileURL;
}

export function timestampToDate(stamp) {
    var date = new Date(stamp); //时间戳为10位需*1000，时间戳为13位的话不需乘1000
    const fill = v => (v < 10 ? '0' : '') + v;
    var Y = date.getFullYear();
    var M = fill(date.getMonth());
    var D = fill(date.getDate());
    var h = fill(date.getHours());
    var m = fill(date.getMinutes());
    var s = fill(date.getSeconds());
    return Y + '-' + M + '-' + D + ' ' + h + ':' + m + ':' + s;
}

//返回云fileID
export function savebase64image(data) {
    var save = wx.getFileSystemManager();
    var name = wx.env.USER_DATA_PATH + '/picture.png';
    return new Promise((resolve, reject) => {
        save.writeFile({
            filePath: name,
            data: data,
            encoding: 'base64',
            success: async res => {
                try {
                    let upres = await uploadToCloud(name,"api-respond");
                    console.log("上传成功");
                    save.unlink({
                        filePath: name,
                        success: res => {
                            console.log("删除临时文件");
                            resolve(upres.fileID)
                        },
                        fail: err => {
                            console.log("删除失败", err);
                        }
                    })
                } catch (error) {
                    console.log(error);
                    reject();
                }
            },
            fail: err => {
                console.log(err)
                reject();
            }
        })
    })
}

export class Color {
    r = 0;
    g = 0;
    b = 0;
    a = 255;
    /**
     * @param {number} r 红
     * @param {number} g 绿
     * @param {number} b 蓝
     * @param {number} a 透明度
     */
    constructor(r, g, b, a = 255) {
        this.r = Math.floor(r);
        this.g = Math.floor(g);
        this.b = Math.floor(b);
        this.a = Math.floor(a);
        this.trim();
    }

    copy(){
        return new Color(this.r,this.g,this.b,this.a);
    }

    add(color){
        ['r', 'g', 'b'].forEach(v => {
            this[v]+=color[v];
        })
        return this;
    }

    multiple(k){
        ['r', 'g', 'b'].forEach(v => {
            this[v]*=k;
        })
        return this;
    }

    trim(){
        ['r', 'g', 'b', 'a'].forEach(v => {
            if (this[v] < 0) this[v] = 0;
            if (this[v] > 255) this[v] = 255;
        })
        return this;
    }

    /**
     * @returns {{number}}
     */
    getIndex() {
        return (this.a << 24) | (this.r << 16) | (this.g << 8) | (this.b << 0);
    }

    /**
     * 
     * @param {Color} cA 
     * @param {Color} cB 
     */
    static getSum(cA, cB) {
        return new Color(
            (cA.r + cB.r) ,//% 255, 
            (cA.g + cB.g) ,//% 255, 
            (cA.b + cB.b) ,//% 255, 
            (cA.a + cB.a) ,//% 255);
        );
    }

    
    static fromIndex(index) {
        return new Color(
            (index >> 16) & 0xff,
            (index >> 8) & 0xff,
            (index >> 0) & 0xff,
            (index >> 24) & 0xff,
        );
    }

    /**
     * 
     * @param {Color} cA 
     * @param {Color} cB 
     */
    static differ(cA, cB) {
        let rmean = (cA.r + cB.r) / 2;
        let R = cA.r - cB.r;
        let G = cA.g - cB.g;
        let B = cA.b - cB.b;
        let res = Math.sqrt((2 + rmean / 256) * (R * R) + 4 * (G * G) + (2 + (255 - rmean) / 256) * (B * B));
        return res;
    }

    static randc() {
        return new Color(Math.random() * 255, Math.random() * 255, Math.random() * 255, Math.random() * 255);
    }
}

export class EasyImage {
    /**
     * @type {number}
     */
    width = 0;
    /**
     * @type {number}
     */
    height = 0;
    /**
     * @type {Array<Array<Color>>}
     */
    data = new Array();

    /**
     * @param {number} width 图片宽度
     * @param {number} height 图片高度
     * @param {Color} init 初始颜色
     */
    constructor(width, height) {
        this.initdata(width, height);
    }

    initdata(width, height) {
        let init = new Color(0, 0, 0, 255);
        this.width = width;
        this.height = height;
        this.data.length = 0;
        for (let i = 0; i < height; ++i) {
            let line = new Array();
            for (let j = 0; j < width; ++j) {
                line.push(new Color(init.r, init.g, init.b, init.a));
            }
            this.data.push(line);
        }
    }

    judge(w, h) {
        if (w < 0 || w >= this.width) {
            throw `x坐标越界:[${w},${h}],size=[${this.width},${this.height}]`;
        }
        if (h < 0 || h >= this.height) {
            throw `y坐标越界:[${w},${h}],size=[${this.width},${this.height}]`;
        }
    }

    /**
     * @returns {Color} 返回该点的颜色
     * @param {number} w 距离左上角的宽度
     * @param {number} h 距离左上角的高度
     */
    get(w, h) {
        w = Math.floor(w);
        h = Math.floor(h);
        this.judge(w, h)
        let index = h * this.width + w;
        //return new Color(scr[index], scr[index + 1], scr[index + 2], scr[index + 3]);
        return this.data[h][w].copy();
    }

    /**
     * 
     * @param {number} w 距离左上角的宽度
     * @param {number} h 距离左上角的高度
     * @param {Color} color 待填充的颜色
     */
    set(w, h, color) {
        w = Math.floor(w);
        h = Math.floor(h);
        this.judge(w, h)
        //let index = h * this.width + w;
        // this.source[index + 0] = color.r;
        // this.source[index + 1] = color.g;
        // this.source[index + 2] = color.b;
        // this.source[index + 3] = color.a;
        this.data[h][w] = color.copy();
    }

    /**
     * 
     * @param {any} ptr page的指针
     * @param {String} path 图片路径
     * @param {Object} size
     */
    async loadFromPath(ptr, path, size) {
        let cid = "canvas";
        
        let canvas =wx.createCanvasContext(cid, ptr);
        return new Promise((resolve, reject) => {
            try {
                wx.getImageInfo({
                    src: path,
                    success: res => {
                        this.initdata(size.width, size.height);
                        canvas.drawImage(res.path, 0, 0, size.width, size.height);
                        canvas.draw(false, () => {
                            wx.canvasGetImageData({
                                canvasId: cid,
                                height: size.height,
                                width: size.width,
                                x: 0,
                                y: 0,
                                success: img => {
                                    this.loadUint8Clamp(img.data);
                                    resolve();
                                }
                            })
                        })
                    },
                    fail: e => {
                        reject(e);
                    }
                })
            } catch (error) {
                reject(error);
            }
        })
    }

    /**
     * @description 导入Uint8ClampedArray数据
     * @param {Uint8ClampedArray} scr 源数据
     */
    loadUint8Clamp(scr) {
        let truelength = this.width * this.height;
        if (scr.length != truelength * 4) {
            console.error("数组大小与图片不符");
            return;
        }
        for (let fact = 0; fact < truelength; ++fact) {
            let index = fact << 2;
            let h = Math.floor(fact / this.width);
            let w = fact % this.width;
            this.data[h][w] = new Color(scr[index], scr[index + 1], scr[index + 2], scr[index + 3]);
        }
    }

    /**
     * @returns {Uint8ClampedArray} 可绘制在canvas上的数据
     */
    getUint8Clamp() {
        let truelength = this.width * this.height;
        let res = new Uint8ClampedArray(truelength * 4);
        for (let fact = 0; fact < truelength; ++fact) {
            let index = fact << 2;
            let h = Math.floor(fact / this.width);
            let w = fact % this.width;
            let color = this.data[h][w];
            res[index + 0] = color.r;
            res[index + 1] = color.g;
            res[index + 2] = color.b;
            res[index + 3] = color.a;
        }
        return res;
    }
}

/**
 * @returns {EasyImage|Promise}
 * @param {EasyImage} img 
 */
export async function dft(img) {

}

export class ImageOps {

    dowhat = dft;

    constructor(howdo = dft) {
        this.dowhat = howdo;
    }

    /**
     * @returns {Promise} 返回可直接绘制的数据流
     * @param {Uint8ClampedArray} data 源数据
     */
    async deal(data, args) {
        return new Promise(async (resolve, reject) => {
            try {
                let img = new EasyImage(args.width, args.height);
                img.loadUint8Clamp(data);
                let res = await this.dowhat(img, args.need);
                resolve(res.getUint8Clamp());
            } catch (error) {
                reject(error);
            }
        });
    }
}
