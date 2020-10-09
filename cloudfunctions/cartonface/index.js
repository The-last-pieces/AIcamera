// 云函数入口文件
const cloud = require('wx-server-sdk')
const tencentcloud = require("tencentcloud-sdk-nodejs");

cloud.init({
    env: 'yun-camera-2goai5iv8534a6e0'
})

async function getUrl(fid) {
    let urls = await cloud.getTempFileURL({
        fileList: [fid]
    });
    return urls.fileList[0].tempFileURL;
}

async function cartonface(fid) {
    let url = await getUrl(fid);

    const FtClient = tencentcloud.ft.v20200304.Client;
    const models = tencentcloud.ft.v20200304.Models;

    const Credential = tencentcloud.common.Credential;
    const ClientProfile = tencentcloud.common.ClientProfile;
    const HttpProfile = tencentcloud.common.HttpProfile;

    let cred = new Credential("AKID4xe3D8yQAk6BC3jrutziFnlslP7b2nV3", "Tielmb8XVIp7dvwlM0RcXDdqoWUJrHVW");
    let httpProfile = new HttpProfile();
    httpProfile.endpoint = "ft.tencentcloudapi.com";
    let clientProfile = new ClientProfile();
    clientProfile.httpProfile = httpProfile;
    let client = new FtClient(cred, "ap-beijing", clientProfile);

    let req = new models.FaceCartoonPicRequest();

    let params = {
        //"Image": base64data,
        "Url": url,
        "RspImgType":"base64",// "url",
        //"DisableGlobalEffect":true
    };
    req.from_json_string(JSON.stringify(params));

    return new Promise((resolve, reject) => {
        client.FaceCartoonPic(req, function (errMsg, response) {
            if (errMsg) {
                reject(errMsg);
                return;
            }
            resolve(response.ResultImage);
            //resolve(response.ResultUrl);
        });
    })
}

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    let data = "",code = true;
    try {
        data = await cartonface(event.id);
    } catch (error) {
        code = false;
    }
    return {
        data,
        code,
        event,
        openid: wxContext.OPENID,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID,
    }
}