// 云函数入口文件
const cloud = require('wx-server-sdk')
const tencentcloud = require("tencentcloud-sdk-nodejs"); //修改路径,然后上传

cloud.init({
    env: 'yun-camera-2goai5iv8534a6e0'
})

async function FaceDetect(url) {
    //准备参数
    const IaiClient = tencentcloud.iai.v20180301.Client;
    const models = tencentcloud.iai.v20180301.Models;

    const Credential = tencentcloud.common.Credential;
    const ClientProfile = tencentcloud.common.ClientProfile;
    const HttpProfile = tencentcloud.common.HttpProfile;

    let cred = new Credential("AKID4xe3D8yQAk6BC3jrutziFnlslP7b2nV3", "Tielmb8XVIp7dvwlM0RcXDdqoWUJrHVW");
    let httpProfile = new HttpProfile();
    httpProfile.endpoint = "iai.tencentcloudapi.com";
    let clientProfile = new ClientProfile();
    clientProfile.httpProfile = httpProfile;
    let client = new IaiClient(cred, "ap-beijing", clientProfile);

    //构造请求
    let req = new models.DetectFaceRequest();
    let params = {
        Url: url,
        NeedFaceAttributes: 1,
        NeedQualityDetection: 1
    };
    req.from_json_string(JSON.stringify(params));

    // promise封装结果
    return new Promise((resolve, reject) => {
        client.DetectFace(req, function (errMsg, response) {
            if (errMsg) {
                reject(errMsg);
                return;
            }
            resolve(response);
        });
    })
}

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    return {
        code: false,
        data: (await FaceDetect(event.id)),
        event,
        openid: wxContext.OPENID,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID,
    }
}
