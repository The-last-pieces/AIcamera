/* global getApp, Page */

import regeneratorRuntime from "../../libs/runtime";

Page({
  data: {
    title: "AICamera"
  },
  onLoad() {
    let app = getApp();
    if (app && app.globalData && app.globalData.userInfo) {
      this.setUserInfo(app.globalData);
    }
  },
  start() {
    wx.navigateTo({
      url: "../main/main"
    });
  },
  history() {
    wx.navigateTo({
      url: "../history/history"
    });
  },
  async logins(e) {
    try {
      let info = null;
      // 点击登陆按钮，进行首次授权并登陆
      if (e && e.detail && e.detail.userInfo) {
        let {
          detail: {
            userInfo
          }
        } = e;
        info = {
          userInfo: userInfo
        };
        this.setUserInfo(info);
      } else {
        throw {
          message: "登录失败"
        };
      }
    } catch (e) {
      console.log(e);
      wx.showToast({
        title: "登陆失败，请重试",
        icon: "none",
        mask: true
      });
    }
  },
  setUserInfo(info) {
    this.setData({
      userInfo: info ? info.userInfo : null
    });
    let app = getApp();
    app.globalData.userInfo = this.data.userInfo;
  }
});
